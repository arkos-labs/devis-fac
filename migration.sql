-- ============================================================
-- MIGRATION — CRM Nettoyage
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Colonnes manquantes dans factures ──────────────────────
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS avoir_de_facture_id      UUID REFERENCES public.factures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS taux_penalites_retard     NUMERIC(5,2) DEFAULT 12,
  ADD COLUMN IF NOT EXISTS indemnite_recouvrement    NUMERIC(10,2) DEFAULT 40,
  ADD COLUMN IF NOT EXISTS note_google_snapshot      NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS nombre_avis_google_snapshot INT;

-- ── 2. Colonnes manquantes dans devis ────────────────────────
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS note_google_snapshot      NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS nombre_avis_google_snapshot INT;

-- ── 3. Colonnes manquantes dans parametres_compte ────────────
ALTER TABLE public.parametres_compte
  ADD COLUMN IF NOT EXISTS afficher_avis_sur_devis    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS afficher_avis_sur_factures BOOLEAN NOT NULL DEFAULT true;

-- ── 4. TABLE : catalogue_prestations ─────────────────────────
CREATE TABLE IF NOT EXISTS public.catalogue_prestations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nom         TEXT NOT NULL,
    prix_defaut NUMERIC(10,2) NOT NULL DEFAULT 0,
    unite       TEXT NOT NULL DEFAULT 'forfait',
    parent_id   UUID REFERENCES public.catalogue_prestations(id) ON DELETE SET NULL,
    is_upsell   BOOLEAN NOT NULL DEFAULT false,
    ordre       INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogue_user_id ON public.catalogue_prestations(user_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_ordre   ON public.catalogue_prestations(user_id, ordre);

COMMENT ON TABLE public.catalogue_prestations IS 'Catalogue des prestations et options upsell par utilisateur.';

-- RLS pour catalogue_prestations
ALTER TABLE public.catalogue_prestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_prestations FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalogue_prestations' AND policyname='proprio_select_catalogue') THEN
    CREATE POLICY "proprio_select_catalogue" ON public.catalogue_prestations FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalogue_prestations' AND policyname='proprio_insert_catalogue') THEN
    CREATE POLICY "proprio_insert_catalogue" ON public.catalogue_prestations FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalogue_prestations' AND policyname='proprio_update_catalogue') THEN
    CREATE POLICY "proprio_update_catalogue" ON public.catalogue_prestations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalogue_prestations' AND policyname='proprio_delete_catalogue') THEN
    CREATE POLICY "proprio_delete_catalogue" ON public.catalogue_prestations FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_prestations TO authenticated;

-- Trigger updated_at
CREATE OR REPLACE TRIGGER trg_catalogue_updated_at
    BEFORE UPDATE ON public.catalogue_prestations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. Mise à jour trigger signup ────────────────────────────
-- Maintenant il utilise aussi les metadata pour pré-remplir les paramètres
CREATE OR REPLACE FUNCTION public.on_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.parametres_compte (
        user_id,
        nom_entreprise,
        siret,
        adresse_entreprise,
        email_entreprise,
        telephone_entreprise
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nom_entreprise', 'Mon Entreprise'),
        COALESCE(NEW.raw_user_meta_data->>'siret', ''),
        NULLIF(COALESCE(NEW.raw_user_meta_data->>'adresse_entreprise', ''), ''),
        NULLIF(COALESCE(NEW.raw_user_meta_data->>'email_entreprise', ''), ''),
        NULLIF(COALESCE(NEW.raw_user_meta_data->>'telephone_entreprise', ''), '')
    )
    ON CONFLICT (user_id) DO UPDATE SET
        nom_entreprise       = EXCLUDED.nom_entreprise,
        siret                = EXCLUDED.siret,
        adresse_entreprise   = EXCLUDED.adresse_entreprise,
        email_entreprise     = EXCLUDED.email_entreprise,
        telephone_entreprise = EXCLUDED.telephone_entreprise;

    INSERT INTO public.configuration_relances (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- ── 6. Index sur avoir_de_facture_id ────────────────────────
CREATE INDEX IF NOT EXISTS idx_factures_avoir ON public.factures(avoir_de_facture_id);

-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
-- ── 7. Colonne titre ──────────────────────────────────────────
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS titre TEXT;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS titre TEXT;
-- ── 8. Maj convertir_devis_en_facture ─────────────────────────
CREATE OR REPLACE FUNCTION public.convertir_devis_en_facture(p_devis_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func
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

    v_numero := public.get_next_numero(p_user_id, 'facture');

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
$func;
