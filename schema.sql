-- ============================================================
-- SUPABASE SCHEMA — CRM & FACTURATION NETTOYAGE SPÉCIALISÉ
-- Version : 1.0.0
-- Auteur   : Antigravity Senior Dev
-- ============================================================
-- IMPORTANT : Exécuter ce script dans l'ordre exact.
-- L'extension pgcrypto est activée par défaut sur Supabase.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS & CONFIGURATION
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schéma applicatif isolé (bonne pratique)
-- On reste dans "public" pour compatibilité Supabase Auth.


-- ============================================================
-- 1. TABLE : parametres_compte
--    Stocke la configuration globale (SIRET, logo, etc.)
--    Une seule ligne par compte admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametres_compte (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nom_entreprise      TEXT NOT NULL DEFAULT 'Mon Entreprise',
    siret               TEXT NOT NULL DEFAULT '99039012200028',
    adresse_entreprise  TEXT,
    telephone_entreprise TEXT,
    email_entreprise    TEXT,
    logo_url            TEXT,            -- URL Supabase Storage
    signature_url       TEXT,            -- URL Supabase Storage
    mentions_legales    TEXT NOT NULL DEFAULT 'Auto-entrepreneur – TVA non applicable, art. 293 B du CGI. Sous réserve de disponibilité d''eau et d''électricité.',
    avis_google_url     TEXT,            -- Lien vers la page Google Avis
    note_google         NUMERIC(2,1) DEFAULT 5.0,
    nombre_avis_google  INT DEFAULT 0,
    -- Numérotation : prochains numéros disponibles
    prochain_num_devis  INT NOT NULL DEFAULT 1,
    prochain_num_facture INT NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Un seul enregistrement par utilisateur
    CONSTRAINT uq_parametres_user UNIQUE (user_id)
);

COMMENT ON TABLE public.parametres_compte IS 'Configuration globale du compte (SIRET, logo, mentions légales, numérotation).';


-- ============================================================
-- 2. TABLE : clients (CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nom             TEXT NOT NULL,
    email           TEXT,
    telephone       TEXT,
    adresse         TEXT,
    ville           TEXT,
    code_postal     TEXT,
    notes           TEXT,               -- Notes internes CRM
    date_creation   TIMESTAMPTZ NOT NULL DEFAULT now(),
    dernier_contact TIMESTAMPTZ,
    -- Contrainte : email valide si fourni
    CONSTRAINT chk_email_format CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Index pour les recherches CRM fréquentes
CREATE INDEX IF NOT EXISTS idx_clients_user_id  ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_nom       ON public.clients(user_id, nom);
CREATE INDEX IF NOT EXISTS idx_clients_email     ON public.clients(user_id, email);

COMMENT ON TABLE public.clients IS 'CRM : répertoire des clients avec historique de contact.';


-- ============================================================
-- 3. TABLE : devis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.devis (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    -- Numéro unique au format D-XXXX (ex: D-0085)
    numero          TEXT NOT NULL,
    date_creation   TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_validite   TIMESTAMPTZ,        -- Date d'expiration du devis
    statut          TEXT NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente', 'accepte', 'refuse', 'expire')),
    montant_ht      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    montant_total   NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- = HT (TVA non applicable)
    notes_client    TEXT,               -- Visible sur le PDF
    notes_internes  TEXT,               -- Non visible sur le PDF
    -- Traçabilité de la génération IA
    genere_par_ia   BOOLEAN NOT NULL DEFAULT false,
    prompt_ia       TEXT,               -- Prompt utilisé pour l'IA
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Le numéro doit être unique par compte
    CONSTRAINT uq_devis_numero_user UNIQUE (user_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_devis_user_id    ON public.devis(user_id);
CREATE INDEX IF NOT EXISTS idx_devis_client_id  ON public.devis(client_id);
CREATE INDEX IF NOT EXISTS idx_devis_statut     ON public.devis(user_id, statut);
CREATE INDEX IF NOT EXISTS idx_devis_date       ON public.devis(user_id, date_creation DESC);

COMMENT ON TABLE public.devis IS 'Devis commerciaux avec numérotation stricte et traçabilité IA.';


-- ============================================================
-- 4. TABLE : factures
-- ============================================================
CREATE TABLE IF NOT EXISTS public.factures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    -- Optionnel : issu d'une conversion de devis
    devis_id        UUID REFERENCES public.devis(id) ON DELETE SET NULL,
    -- Numéro unique au format F-XXXX (ex: F-0085)
    numero          TEXT NOT NULL,
    date_creation   TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_echeance   TIMESTAMPTZ,        -- Date limite de paiement
    statut          TEXT NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente', 'payee', 'retard', 'annulee')),
    montant_ht      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    montant_total   NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notes_client    TEXT,
    notes_internes  TEXT,
    date_paiement   TIMESTAMPTZ,        -- Renseignée quand statut = 'payee'
    moyen_paiement  TEXT CHECK (moyen_paiement IN ('virement', 'cheque', 'especes', 'carte', 'autre')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_facture_numero_user UNIQUE (user_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_factures_user_id   ON public.factures(user_id);
CREATE INDEX IF NOT EXISTS idx_factures_client_id ON public.factures(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_devis_id  ON public.factures(devis_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut    ON public.factures(user_id, statut);
CREATE INDEX IF NOT EXISTS idx_factures_date      ON public.factures(user_id, date_creation DESC);

COMMENT ON TABLE public.factures IS 'Factures avec numérotation stricte, suivi de paiement, lien optionnel au devis.';


-- ============================================================
-- 5. TABLE : configuration_relances
--    Configuration des relances automatiques par utilisateur
--    Permet chaque user de configurer les triggers de relance
-- ============================================================
CREATE TABLE IF NOT EXISTS public.configuration_relances (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mois_sans_activite INT NOT NULL DEFAULT 6,  -- Ex: 6 mois
    message_relance TEXT NOT NULL DEFAULT 'Bonjour, nous aimerions renouveler notre collaboration. N''hésitez pas à nous recontacter.',
    actif           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Un seul enregistrement par utilisateur
    CONSTRAINT uq_config_relances_user UNIQUE (user_id)
);

COMMENT ON TABLE public.configuration_relances IS 'Configuration des relances automatiques (délai, message).';

CREATE INDEX IF NOT EXISTS idx_config_relances_user_id ON public.configuration_relances(user_id);


-- ============================================================
-- 5b. TABLE : relances_historique
--     Track des relances envoyées pour éviter les doublons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.relances_historique (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    date_relance    TIMESTAMPTZ NOT NULL DEFAULT now(),
    message         TEXT NOT NULL,
    type_relance    TEXT NOT NULL DEFAULT 'email' CHECK (type_relance IN ('email', 'sms', 'notification')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.relances_historique IS 'Historique des relances envoyées pour chaque client.';

CREATE INDEX IF NOT EXISTS idx_relances_user_id    ON public.relances_historique(user_id);
CREATE INDEX IF NOT EXISTS idx_relances_client_id  ON public.relances_historique(client_id);
CREATE INDEX IF NOT EXISTS idx_relances_date       ON public.relances_historique(user_id, date_relance DESC);


-- ============================================================
-- 6. TABLE : lignes_prestation
--    Lignes de détail pour DEVIS et FACTURES
--    On utilise une colonne discriminante (document_type)
--    pour pointer vers la bonne table parente.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lignes_prestation (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Lien polymorphique sécurisé
    document_type   TEXT NOT NULL CHECK (document_type IN ('devis', 'facture')),
    document_id     UUID NOT NULL,      -- FK vers devis.id OU factures.id selon document_type
    -- Données de la prestation
    ordre           INT NOT NULL DEFAULT 0,  -- Ordre d'affichage dans le PDF
    description     TEXT NOT NULL,
    detail          TEXT,               -- Description longue / sous-détail
    quantite        NUMERIC(8, 2) NOT NULL DEFAULT 1,
    unite           TEXT DEFAULT 'forfait', -- ex: m², heure, forfait
    prix_unitaire   NUMERIC(10, 2) NOT NULL,
    montant_ligne   NUMERIC(12, 2) GENERATED ALWAYS AS (quantite * prix_unitaire) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lignes_document ON public.lignes_prestation(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_lignes_user_id  ON public.lignes_prestation(user_id);

COMMENT ON TABLE public.lignes_prestation IS 'Lignes de prestation pour devis et factures (polymorphique).';


-- ============================================================
-- 7. TRIGGERS : updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_devis_updated_at
    BEFORE UPDATE ON public.devis
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_factures_updated_at
    BEFORE UPDATE ON public.factures
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_parametres_updated_at
    BEFORE UPDATE ON public.parametres_compte
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 8. TRIGGER : Synchronisation montant_total sur devis/facture
--    Recalcule automatiquement le montant_total du document
--    quand une ligne est insérée, modifiée ou supprimée.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_montant_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total NUMERIC(12,2);
    v_doc_id UUID;
    v_doc_type TEXT;
BEGIN
    -- Déterminer l'ID et le type du document impacté
    IF TG_OP = 'DELETE' THEN
        v_doc_id   := OLD.document_id;
        v_doc_type := OLD.document_type;
    ELSE
        v_doc_id   := NEW.document_id;
        v_doc_type := NEW.document_type;
    END IF;

    -- Calculer le nouveau total
    SELECT COALESCE(SUM(montant_ligne), 0)
    INTO v_total
    FROM public.lignes_prestation
    WHERE document_id = v_doc_id AND document_type = v_doc_type;

    -- Mettre à jour la table parente
    IF v_doc_type = 'devis' THEN
        UPDATE public.devis
        SET montant_ht = v_total, montant_total = v_total, updated_at = now()
        WHERE id = v_doc_id;
    ELSIF v_doc_type = 'facture' THEN
        UPDATE public.factures
        SET montant_ht = v_total, montant_total = v_total, updated_at = now()
        WHERE id = v_doc_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_montant_devis_facture
    AFTER INSERT OR UPDATE OR DELETE ON public.lignes_prestation
    FOR EACH ROW EXECUTE FUNCTION public.sync_montant_document();


-- ============================================================
-- 9. FONCTION CRITIQUE : Numérotation stricte sans doublon
--    Utilise un verrou consultatif PostgreSQL (advisory lock)
--    pour garantir l'atomicité même en cas de requêtes concurrentes.
--    Retourne le prochain numéro formaté et l'incrémente.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_next_numero(
    p_user_id   UUID,
    p_type      TEXT  -- 'devis' ou 'facture'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next_num  INT;
    v_prefix    TEXT;
    v_lock_key  BIGINT;
    v_result    TEXT;
BEGIN
    -- Validation du type
    IF p_type NOT IN ('devis', 'facture') THEN
        RAISE EXCEPTION 'Type invalide : %. Valeurs acceptées : devis, facture.', p_type;
    END IF;

    -- Définir le préfixe selon le type
    IF p_type = 'devis' THEN
        v_prefix := 'D-';
    ELSE
        v_prefix := 'F-';
    END IF;

    -- Verrou consultatif basé sur user_id + type pour éviter les doublons
    -- On utilise hashtext pour convertir l'UUID en BIGINT de manière déterministe
    v_lock_key := hashtext(p_user_id::TEXT || '_' || p_type);

    -- Acquérir le verrou de transaction (bloquant, libéré en fin de transaction)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Lire et incrémenter atomiquement dans une seule requête
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

    -- Vérification : l'utilisateur doit avoir ses paramètres initialisés
    IF v_next_num IS NULL THEN
        RAISE EXCEPTION 'Paramètres compte introuvables pour user_id = %. Initialisez votre compte.', p_user_id;
    END IF;

    -- Formater le numéro : D-0085 ou F-0085 (4 chiffres minimum, extensible automatiquement)
    v_result := v_prefix || LPAD(v_next_num::TEXT, 4, '0');

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_next_numero IS
'Génère un numéro de devis (D-XXXX) ou facture (F-XXXX) unique et séquentiel.
Utilise un verrou transactionnel PostgreSQL (advisory lock) pour garantir
l''absence de doublon même sous haute concurrence. Doit être appelé dans une transaction.';


-- ============================================================
-- 10. FONCTION : Conversion devis → facture (1 clic)
--    Crée une facture complète depuis un devis.
-- ============================================================
CREATE OR REPLACE FUNCTION public.convertir_devis_en_facture(
    p_devis_id  UUID,
    p_user_id   UUID
)
RETURNS UUID  -- Retourne l'ID de la nouvelle facture
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_devis         RECORD;
    v_num_facture   TEXT;
    v_facture_id    UUID;
BEGIN
    -- Récupérer le devis et vérifier les droits
    SELECT * INTO v_devis
    FROM public.devis
    WHERE id = p_devis_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Devis introuvable ou accès non autorisé (id=%).', p_devis_id;
    END IF;

    -- Vérifier qu'il n'y a pas déjà une facture pour ce devis
    IF EXISTS (SELECT 1 FROM public.factures WHERE devis_id = p_devis_id) THEN
        RAISE EXCEPTION 'Ce devis (%) a déjà été converti en facture.', v_devis.numero;
    END IF;

    -- Générer le numéro de facture (atomique)
    v_num_facture := public.get_next_numero(p_user_id, 'facture');

    -- Créer la facture
    INSERT INTO public.factures (
        user_id, client_id, devis_id, numero,
        date_echeance, statut, montant_ht, montant_total,
        notes_client, notes_internes
    )
    VALUES (
        p_user_id,
        v_devis.client_id,
        p_devis_id,
        v_num_facture,
        now() + INTERVAL '30 days',   -- Échéance par défaut : 30 jours
        'en_attente',
        v_devis.montant_total,
        v_devis.montant_total,
        v_devis.notes_client,
        v_devis.notes_internes
    )
    RETURNING id INTO v_facture_id;

    -- Copier les lignes de prestation du devis vers la facture
    INSERT INTO public.lignes_prestation (
        user_id, document_type, document_id,
        ordre, description, detail, quantite, unite, prix_unitaire
    )
    SELECT
        user_id, 'facture', v_facture_id,
        ordre, description, detail, quantite, unite, prix_unitaire
    FROM public.lignes_prestation
    WHERE document_type = 'devis' AND document_id = p_devis_id;

    -- Marquer le devis comme accepté (s'il ne l'était pas déjà)
    UPDATE public.devis
    SET statut = 'accepte', updated_at = now()
    WHERE id = p_devis_id AND statut = 'en_attente';

    RETURN v_facture_id;
END;
$$;

COMMENT ON FUNCTION public.convertir_devis_en_facture IS
'Convertit un devis en facture en 1 opération atomique :
génère le numéro de facture, duplique les lignes de prestation,
lie la facture au devis source.';


-- ============================================================
-- 11. FONCTION : Statistiques Dashboard
--     Retourne les KPIs agrégés pour le dashboard.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        -- CA encaissé ce mois
        'ca_mois_courant', (
            SELECT COALESCE(SUM(montant_total), 0)
            FROM public.factures
            WHERE user_id = p_user_id
              AND statut = 'payee'
              AND date_trunc('month', date_paiement) = date_trunc('month', now())
        ),
        -- CA encaissé cette année
        'ca_annee_courante', (
            SELECT COALESCE(SUM(montant_total), 0)
            FROM public.factures
            WHERE user_id = p_user_id
              AND statut = 'payee'
              AND date_trunc('year', date_paiement) = date_trunc('year', now())
        ),
        -- CA à venir (factures en attente)
        'ca_a_venir', (
            SELECT COALESCE(SUM(montant_total), 0)
            FROM public.factures
            WHERE user_id = p_user_id
              AND statut = 'en_attente'
        ),
        -- Taux d'acceptation des devis (%)
        'taux_acceptation_devis', (
            SELECT CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND(
                    COUNT(*) FILTER (WHERE statut = 'accepte') * 100.0 / COUNT(*),
                    1
                )
            END
            FROM public.devis
            WHERE user_id = p_user_id
              AND statut IN ('accepte', 'refuse')
        ),
        -- Nombre de devis en attente
        'devis_en_attente', (
            SELECT COUNT(*) FROM public.devis
            WHERE user_id = p_user_id AND statut = 'en_attente'
        ),
        -- Nombre de factures en retard
        'factures_en_retard', (
            SELECT COUNT(*) FROM public.factures
            WHERE user_id = p_user_id AND statut = 'retard'
        ),
        -- Nombre total de clients
        'total_clients', (
            SELECT COUNT(*) FROM public.clients
            WHERE user_id = p_user_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;


-- ============================================================
-- 12. ROW LEVEL SECURITY (RLS)
--     Politique : chaque user ne voit QUE ses propres données.
--     L'admin Supabase (service_role) bypasse toutes les RLS.
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.parametres_compte        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_prestation        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuration_relances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relances_historique      ENABLE ROW LEVEL SECURITY;

-- Forcer RLS même pour le propriétaire de la table (sécurité maximale)
ALTER TABLE public.parametres_compte        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clients                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.devis                    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.factures                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_prestation        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.configuration_relances   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.relances_historique      FORCE ROW LEVEL SECURITY;

-- ── parametres_compte ──────────────────────────────────────
CREATE POLICY "proprio_select_parametres" ON public.parametres_compte
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "proprio_insert_parametres" ON public.parametres_compte
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_update_parametres" ON public.parametres_compte
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_delete_parametres" ON public.parametres_compte
    FOR DELETE USING (auth.uid() = user_id);

-- ── clients ───────────────────────────────────────────────
CREATE POLICY "proprio_select_clients" ON public.clients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "proprio_insert_clients" ON public.clients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_update_clients" ON public.clients
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_delete_clients" ON public.clients
    FOR DELETE USING (auth.uid() = user_id);

-- ── devis ─────────────────────────────────────────────────
CREATE POLICY "proprio_select_devis" ON public.devis
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "proprio_insert_devis" ON public.devis
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_update_devis" ON public.devis
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_delete_devis" ON public.devis
    FOR DELETE USING (auth.uid() = user_id);

-- ── factures ──────────────────────────────────────────────
CREATE POLICY "proprio_select_factures" ON public.factures
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "proprio_insert_factures" ON public.factures
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_update_factures" ON public.factures
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_delete_factures" ON public.factures
    FOR DELETE USING (auth.uid() = user_id);

-- ── lignes_prestation ─────────────────────────────────────
CREATE POLICY "proprio_select_lignes" ON public.lignes_prestation
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "proprio_insert_lignes" ON public.lignes_prestation
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_update_lignes" ON public.lignes_prestation
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_delete_lignes" ON public.lignes_prestation
    FOR DELETE USING (auth.uid() = user_id);

-- ── configuration_relances ────────────────────────────────
CREATE POLICY "proprio_select_config_relances" ON public.configuration_relances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "proprio_insert_config_relances" ON public.configuration_relances
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_update_config_relances" ON public.configuration_relances
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_delete_config_relances" ON public.configuration_relances
    FOR DELETE USING (auth.uid() = user_id);

-- ── relances_historique ───────────────────────────────────
CREATE POLICY "proprio_select_relances_histo" ON public.relances_historique
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "proprio_insert_relances_histo" ON public.relances_historique
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_update_relances_histo" ON public.relances_historique
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proprio_delete_relances_histo" ON public.relances_historique
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 13. TRIGGER : Création automatique des paramètres compte
--     Quand un nouvel utilisateur s'inscrit via Supabase Auth,
--     on initialise automatiquement son enregistrement.
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.parametres_compte (user_id, nom_entreprise)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nom_entreprise', 'Mon Entreprise')
    )
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.configuration_relances (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Ce trigger est sur auth.users (schéma auth)
CREATE OR REPLACE TRIGGER trg_on_new_user_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.on_new_user_signup();


-- ============================================================
-- 14. GRANTS (Sécurité)
--     On révoque tout accès public par défaut,
--     puis on accorde uniquement à authenticated.
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametres_compte         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis                     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factures                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lignes_prestation         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuration_relances    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relances_historique       TO authenticated;

-- Accorder l'exécution des fonctions sécurisées
GRANT EXECUTE ON FUNCTION public.get_next_numero(UUID, TEXT)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_devis_en_facture(UUID, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID)               TO authenticated;


-- ============================================================
-- 15. FONCTION : Trouver les clients à relancer
--     Retourne les clients sans activité depuis X mois
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_clients_a_relancer(p_user_id UUID)
RETURNS TABLE (
    client_id UUID,
    nom_client TEXT,
    email_client TEXT,
    mois_depuis_activite INT,
    dernier_contact TIMESTAMPTZ
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mois_config INT;
BEGIN
    -- Récupérer la configuration de l'utilisateur
    SELECT mois_sans_activite INTO v_mois_config
    FROM public.configuration_relances
    WHERE user_id = p_user_id AND actif = true;

    IF v_mois_config IS NULL THEN
        v_mois_config := 6; -- Valeur par défaut
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.nom,
        c.email,
        EXTRACT(EPOCH FROM (now() - COALESCE(c.dernier_contact, c.date_creation))) / (86400 * 30)::INT AS mois,
        c.dernier_contact
    FROM public.clients c
    WHERE c.user_id = p_user_id
      AND (c.dernier_contact IS NULL OR
           EXTRACT(EPOCH FROM (now() - c.dernier_contact)) / (86400 * 30) >= v_mois_config)
      -- Vérifier qu'il n'y a pas de relance envoyée dans les 30 derniers jours
      AND NOT EXISTS (
          SELECT 1 FROM public.relances_historique rh
          WHERE rh.client_id = c.id
            AND rh.user_id = p_user_id
            AND rh.date_relance > now() - INTERVAL '30 days'
      );
END;
$$;

COMMENT ON FUNCTION public.get_clients_a_relancer IS 'Retourne les clients sans activité depuis X mois (configurable).';

GRANT EXECUTE ON FUNCTION public.get_clients_a_relancer(UUID) TO authenticated;


-- ============================================================
-- 16. FONCTION : Envoyer une relance à un client
--     Enregistre la relance et met à jour dernier_contact
-- ============================================================
CREATE OR REPLACE FUNCTION public.envoyer_relance(
    p_user_id UUID,
    p_client_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client RECORD;
    v_config RECORD;
    v_relance_id UUID;
    v_result JSON;
BEGIN
    -- Vérifier les droits
    SELECT * INTO v_client FROM public.clients
    WHERE id = p_client_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Client introuvable');
    END IF;

    -- Récupérer la configuration de relance
    SELECT * INTO v_config FROM public.configuration_relances
    WHERE user_id = p_user_id;

    -- Enregistrer la relance
    INSERT INTO public.relances_historique (user_id, client_id, message, type_relance)
    VALUES (p_user_id, p_client_id, v_config.message_relance, 'email')
    RETURNING id INTO v_relance_id;

    -- Mettre à jour dernier_contact du client
    UPDATE public.clients
    SET dernier_contact = now()
    WHERE id = p_client_id;

    v_result := json_build_object(
        'success', true,
        'message', 'Relance envoyée avec succès',
        'relance_id', v_relance_id,
        'client_nom', v_client.nom,
        'client_email', v_client.email
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.envoyer_relance IS 'Envoie une relance à un client et enregistre l''action.';

GRANT EXECUTE ON FUNCTION public.envoyer_relance(UUID, UUID) TO authenticated;


-- ============================================================
-- 15. TESTS RAPIDES (commenter en production)
-- ============================================================
-- Après inscription, tester la numérotation :
--
-- SELECT public.get_next_numero('<votre-user-id>', 'devis');
--   Résultat attendu → 'D-0001'
-- SELECT public.get_next_numero('<votre-user-id>', 'devis');
--   Résultat attendu → 'D-0002'
-- SELECT public.get_next_numero('<votre-user-id>', 'facture');
--   Résultat attendu → 'F-0001'
--
-- Conversion devis → facture :
-- SELECT public.convertir_devis_en_facture('<devis-uuid>', '<user-uuid>');
--
-- Dashboard stats :
-- SELECT public.get_dashboard_stats('<user-uuid>');
-- ============================================================


-- ============================================================
-- FIN DU SCRIPT — Supabase SQL Editor
-- ============================================================
