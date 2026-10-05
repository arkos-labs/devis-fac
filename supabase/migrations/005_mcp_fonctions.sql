-- Fonctions réservées au serveur MCP (api/mcp.ts).
--
-- Les fonctions de l'application (get_next_numero, get_dashboard_stats) vérifient
-- auth.uid() = p_user_id. Le serveur MCP utilise la clé service_role, pour laquelle
-- auth.uid() est NULL : elles refusent donc l'appel ("Accès non autorisé").
--
-- Ces copies ont exactement la même logique, sans cette vérification. Elles acceptent
-- un p_user_id arbitraire : elles ne doivent JAMAIS être exécutables par les rôles
-- anon / authenticated. Seul service_role (le serveur MCP, qui passe toujours l'id
-- du compte de la clé) peut les appeler.

-- ── Numérotation ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mcp_next_numero(p_user_id uuid, p_type text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_next_num  INT;
    v_prefix    TEXT;
    v_lock_key  BIGINT;
BEGIN
    IF p_type NOT IN ('devis', 'facture') THEN
        RAISE EXCEPTION 'Type invalide : %. Valeurs acceptées : devis, facture.', p_type;
    END IF;

    IF p_type = 'devis' THEN
        v_prefix := 'D-';
    ELSE
        v_prefix := 'F-';
    END IF;

    -- Même verrou que get_next_numero : pas de doublon, même en concurrence avec l'application
    v_lock_key := hashtext(p_user_id::TEXT || '_' || p_type);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    IF p_type = 'devis' THEN
        UPDATE public.parametres_compte
        SET prochain_num_devis = prochain_num_devis + 1
        WHERE user_id = p_user_id
        RETURNING prochain_num_devis - 1 INTO v_next_num;
    ELSE
        UPDATE public.parametres_compte
        SET prochain_num_facture = prochain_num_facture + 1
        WHERE user_id = p_user_id
        RETURNING prochain_num_facture - 1 INTO v_next_num;
    END IF;

    IF v_next_num IS NULL THEN
        RAISE EXCEPTION 'Paramètres compte introuvables pour user_id = %. Initialisez votre compte.', p_user_id;
    END IF;

    RETURN v_prefix || LPAD(v_next_num::TEXT, 4, '0');
END;
$function$;

-- ── Statistiques ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mcp_dashboard_stats(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'ca_mois_courant', (
            SELECT COALESCE(SUM(montant_total), 0) FROM public.factures
            WHERE user_id = p_user_id AND statut = 'payee'
              AND date_trunc('month', date_paiement) = date_trunc('month', now())
        ),
        'ca_annee_courante', (
            SELECT COALESCE(SUM(montant_total), 0) FROM public.factures
            WHERE user_id = p_user_id AND statut = 'payee'
              AND date_trunc('year', date_paiement) = date_trunc('year', now())
        ),
        'ca_a_venir', (
            SELECT COALESCE(SUM(montant_total), 0) FROM public.factures
            WHERE user_id = p_user_id AND statut = 'en_attente'
        ),
        'taux_acceptation_devis', (
            SELECT CASE WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND(COUNT(*) FILTER (WHERE statut = 'accepte') * 100.0 / COUNT(*), 1)
            END
            FROM public.devis WHERE user_id = p_user_id AND statut IN ('accepte', 'refuse')
        ),
        'devis_en_attente', (
            SELECT COUNT(*) FROM public.devis WHERE user_id = p_user_id AND statut = 'en_attente'
        ),
        'factures_en_retard', (
            SELECT COUNT(*) FROM public.factures WHERE user_id = p_user_id AND statut = 'retard'
        ),
        'total_clients', (
            SELECT COUNT(*) FROM public.clients WHERE user_id = p_user_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$function$;

-- ── Conversion devis accepté → facture ───────────────────────
-- Même logique que convertir_devis_en_facture, mais appelle mcp_next_numero.
CREATE OR REPLACE FUNCTION public.mcp_convertir_devis_en_facture(p_devis_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_facture_id UUID;
    v_numero TEXT;
    v_devis RECORD;
BEGIN
    SELECT * INTO v_devis FROM public.devis
    WHERE id = p_devis_id AND user_id = p_user_id AND statut = 'accepte';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Devis introuvable ou non accepté.';
    END IF;

    v_numero := public.mcp_next_numero(p_user_id, 'facture');

    INSERT INTO public.factures (
        user_id, client_id, devis_id, numero, statut, date_echeance, notes_client, notes_internes, titre
    ) VALUES (
        p_user_id, v_devis.client_id, p_devis_id, v_numero, 'en_attente', CURRENT_DATE + 30, v_devis.notes_client, v_devis.notes_internes, v_devis.titre
    ) RETURNING id INTO v_facture_id;

    INSERT INTO public.lignes_prestation (
        user_id, document_type, document_id, description, detail, quantite, unite, prix_unitaire, ordre, is_upsell
    )
    SELECT
        p_user_id, 'facture', v_facture_id, description, detail, quantite, unite, prix_unitaire, ordre, is_upsell
    FROM public.lignes_prestation
    WHERE document_type = 'devis' AND document_id = p_devis_id;

    UPDATE public.devis SET statut = 'facture' WHERE id = p_devis_id;

    RETURN v_facture_id;
END;
$function$;

-- ── Droits : service_role uniquement ─────────────────────────
-- (PostgreSQL accorde EXECUTE à PUBLIC par défaut : il faut le retirer explicitement.)
REVOKE ALL ON FUNCTION public.mcp_next_numero(uuid, text)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_dashboard_stats(uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_convertir_devis_en_facture(uuid, uuid)     FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mcp_next_numero(uuid, text)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_dashboard_stats(uuid)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_convertir_devis_en_facture(uuid, uuid)  TO service_role;
