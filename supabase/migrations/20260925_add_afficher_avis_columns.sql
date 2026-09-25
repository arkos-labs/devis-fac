-- Migration: Add afficher_avis_sur_devis and afficher_avis_sur_factures columns
-- Date: 2026-09-25
-- Description: Add columns to store user preferences for displaying Google reviews on quotes and invoices

-- Add columns to parametres_compte if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'parametres_compte' AND column_name = 'afficher_avis_sur_devis'
    ) THEN
        ALTER TABLE public.parametres_compte
        ADD COLUMN afficher_avis_sur_devis BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'parametres_compte' AND column_name = 'afficher_avis_sur_factures'
    ) THEN
        ALTER TABLE public.parametres_compte
        ADD COLUMN afficher_avis_sur_factures BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- Add note_google_snapshot column to devis if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devis' AND column_name = 'note_google_snapshot'
    ) THEN
        ALTER TABLE public.devis
        ADD COLUMN note_google_snapshot NUMERIC(2,1);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.parametres_compte.afficher_avis_sur_devis IS 'Afficher les avis Google sur les devis';
COMMENT ON COLUMN public.parametres_compte.afficher_avis_sur_factures IS 'Afficher les avis Google sur les factures';
COMMENT ON COLUMN public.devis.note_google_snapshot IS 'Snapshot de la note Google au moment de la création du devis';
