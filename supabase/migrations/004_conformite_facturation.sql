-- ============================================================
-- MIGRATION — Renforcement de la conformité légale de facturation
-- (numérotation sans trou, immuabilité des lignes de facture)
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Création atomique d'une facture ───────────────────────
-- Numérotation + insertion facture + insertion des lignes dans UNE seule
-- transaction. Si une étape échoue (ex: coupure réseau après la
-- génération du numéro), tout est annulé, y compris l'incrémentation du
-- compteur — le numéro n'est donc jamais perdu/sauté, contrairement à
-- l'ancien flux en 2 appels séparés depuis le client (get_next_numero
-- puis insert), qui pouvait laisser un trou dans la séquence légale.
CREATE OR REPLACE FUNCTION public.creer_facture(
  p_user_id        UUID,
  p_client_id      UUID,
  p_titre          TEXT,
  p_date_echeance  TIMESTAMPTZ,
  p_notes_client   TEXT,
  p_notes_internes TEXT,
  p_lignes         JSONB  -- [{description, detail, quantite, unite, prix_unitaire}, ...]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero      TEXT;
  v_facture_id  UUID;
  v_montant     NUMERIC(12,2);
  v_params      RECORD;
  v_ligne       JSONB;
  v_ordre       INT := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Client introuvable ou accès non autorisé';
  END IF;

  SELECT note_google, nombre_avis_google INTO v_params
  FROM public.parametres_compte WHERE user_id = p_user_id;

  SELECT COALESCE(SUM((l->>'quantite')::numeric * (l->>'prix_unitaire')::numeric), 0)
  INTO v_montant
  FROM jsonb_array_elements(p_lignes) l;

  v_numero := public.get_next_numero(p_user_id, 'facture');

  INSERT INTO public.factures (
    user_id, client_id, devis_id, numero, date_creation, date_echeance,
    notes_client, notes_internes, titre, statut, montant_ht, montant_total,
    note_google_snapshot, nombre_avis_google_snapshot
  ) VALUES (
    p_user_id, p_client_id, NULL, v_numero, now(), p_date_echeance,
    p_notes_client, p_notes_internes, p_titre, 'en_attente', v_montant, v_montant,
    v_params.note_google, v_params.nombre_avis_google
  ) RETURNING id INTO v_facture_id;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    INSERT INTO public.lignes_prestation (
      user_id, document_type, document_id, ordre, description, detail, quantite, unite, prix_unitaire
    ) VALUES (
      p_user_id, 'facture', v_facture_id, v_ordre,
      v_ligne->>'description', NULLIF(v_ligne->>'detail', ''),
      (v_ligne->>'quantite')::numeric, v_ligne->>'unite', (v_ligne->>'prix_unitaire')::numeric
    );
    v_ordre := v_ordre + 1;
  END LOOP;

  RETURN (SELECT row_to_json(f) FROM public.factures f WHERE f.id = v_facture_id);
END;
$$;

COMMENT ON FUNCTION public.creer_facture IS
'Crée une facture et ses lignes de manière atomique (numérotation incluse) : évite tout trou dans la séquence en cas d''échec partiel.';

GRANT EXECUTE ON FUNCTION public.creer_facture(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB) TO authenticated;


-- ── 2. Immuabilité des lignes de facture ─────────────────────
-- Empêche la modification ou la suppression des lignes d'une facture déjà
-- émise (les devis restent librement modifiables tant qu'ils ne sont pas
-- convertis). Complète trg_facture_inalterable, qui ne protège que la
-- table factures elle-même (numero, montants, client_id), pas ses lignes
-- de détail.
CREATE OR REPLACE FUNCTION public.prevent_facture_lignes_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.document_type = 'facture')
     OR (TG_OP = 'DELETE' AND OLD.document_type = 'facture') THEN
    RAISE EXCEPTION 'Les lignes d''une facture émise ne peuvent pas être modifiées ou supprimées. Créez un Avoir.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER trg_facture_lignes_inalterable
  BEFORE UPDATE OR DELETE ON public.lignes_prestation
  FOR EACH ROW EXECUTE FUNCTION public.prevent_facture_lignes_change();

-- ============================================================
-- NOTE : les protections suivantes existaient déjà avant cette migration
-- (ajoutées par un autre correctif) et n'ont pas besoin d'être recréées :
--   - trigger trg_facture_inalterable (bloque le changement de numero,
--     montant_ht, montant_total, client_id, avoir_de_facture_id)
--   - policy RLS "factures_no_delete" (USING false) qui bloque tout DELETE
-- ============================================================

-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
