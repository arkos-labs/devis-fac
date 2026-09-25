-- ============================================================
-- MIGRATION : Ajouter le système B2B/B2C aux clients
-- Version : 1.0
-- Auteur   : Claude Haiku
-- Description : Ajout du champ type (pro/particulier) et des
--               champs spécifiques pour chaque type de client.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Créer le TYPE ENUM pour client_type
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE public.client_type AS ENUM ('professionnel', 'particulier');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Ajouter les colonnes à la table clients
-- ─────────────────────────────────────────────────────────────

-- Champ type (OBLIGATOIRE pour tous les clients)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS type public.client_type NOT NULL DEFAULT 'professionnel';

-- Ajouter un index sur type (recherches fréquentes)
CREATE INDEX IF NOT EXISTS idx_clients_type ON public.clients(user_id, type);

-- ──── Champs spécifiques PROFESSIONNEL ────────────────────────
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS company_name TEXT,          -- Dénomination sociale
ADD COLUMN IF NOT EXISTS siren VARCHAR(9),           -- SIREN (9 chiffres)
ADD COLUMN IF NOT EXISTS siret VARCHAR(14),          -- SIRET (14 chiffres)
ADD COLUMN IF NOT EXISTS vat_number VARCHAR(20),     -- N° TVA intracommunautaire
ADD COLUMN IF NOT EXISTS legal_form VARCHAR(50),     -- Forme juridique (SARL, SAS, etc.)
ADD COLUMN IF NOT EXISTS contact_name TEXT,          -- Nom du contact
ADD COLUMN IF NOT EXISTS service_address TEXT;       -- Adresse de livraison (si différente)

-- Index sur SIREN et SIRET (recherches/validation)
CREATE INDEX IF NOT EXISTS idx_clients_siren ON public.clients(user_id, siren)
WHERE siren IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_siret ON public.clients(user_id, siret)
WHERE siret IS NOT NULL;

-- ──── Champs spécifiques PARTICULIER ──────────────────────────
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS first_name TEXT,            -- Prénom
ADD COLUMN IF NOT EXISTS last_name TEXT,             -- Nom
ADD COLUMN IF NOT EXISTS civility VARCHAR(10),       -- Civilité (M., Mme, etc.)
ADD COLUMN IF NOT EXISTS is_canvassing BOOLEAN DEFAULT false;  -- Démarchage à domicile

-- ──── Champ optionnel PAYS ───────────────────────────────────
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS country VARCHAR(50) DEFAULT 'France';

-- ─────────────────────────────────────────────────────────────
-- 3. CONTRAINTES DE VALIDATION
-- ─────────────────────────────────────────────────────────────

-- Contrainte : SIREN doit faire exactement 9 chiffres s'il est fourni
ALTER TABLE public.clients
ADD CONSTRAINT IF NOT EXISTS chk_siren_format
CHECK (siren IS NULL OR (siren ~ '^\d{9}$'));

-- Contrainte : SIRET doit faire exactement 14 chiffres s'il est fourni
ALTER TABLE public.clients
ADD CONSTRAINT IF NOT EXISTS chk_siret_format
CHECK (siret IS NULL OR (siret ~ '^\d{14}$'));

-- Contrainte : VAT_NUMBER au format FR + 11 chiffres si fourni
ALTER TABLE public.clients
ADD CONSTRAINT IF NOT EXISTS chk_vat_format
CHECK (vat_number IS NULL OR (vat_number ~ '^FR\d{11}$'));

-- Contrainte : Pour type='professionnel', company_name et siren OBLIGATOIRES
ALTER TABLE public.clients
ADD CONSTRAINT IF NOT EXISTS chk_professionnel_required
CHECK (
    type != 'professionnel'::public.client_type
    OR (company_name IS NOT NULL AND siren IS NOT NULL)
);

-- Contrainte : Pour type='particulier', first_name et last_name OBLIGATOIRES
ALTER TABLE public.clients
ADD CONSTRAINT IF NOT EXISTS chk_particulier_required
CHECK (
    type != 'particulier'::public.client_type
    OR (first_name IS NOT NULL AND last_name IS NOT NULL)
);

-- Contrainte : Tous les clients doivent avoir adresse, code_postal, city
ALTER TABLE public.clients
ADD CONSTRAINT IF NOT EXISTS chk_address_required
CHECK (adresse IS NOT NULL AND code_postal IS NOT NULL AND ville IS NOT NULL);

-- ─────────────────────────────────────────────────────────────
-- 4. FONCTION UTILITAIRE : Validation LUHN (SIREN/SIRET)
-- ─────────────────────────────────────────────────────────────
-- Cette fonction valide la clé de Luhn des numéros SIREN/SIRET
CREATE OR REPLACE FUNCTION public.validate_luhn_siren(p_siren TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
AS $$
DECLARE
    v_sum INT := 0;
    v_digit INT;
    v_position INT;
    v_product INT;
    v_len INT;
BEGIN
    IF p_siren IS NULL OR p_siren !~ '^\d{9}$' THEN
        RETURN false;
    END IF;

    v_len := LENGTH(p_siren);

    -- Parcourir les 8 premiers chiffres (le 9e est la clé)
    FOR v_position IN 1..v_len - 1 LOOP
        v_digit := SUBSTRING(p_siren, v_position, 1)::INT;

        -- Doubler les chiffres aux positions paires (1-indexed)
        IF v_position % 2 = 1 THEN
            v_product := v_digit * 2;
            -- Si le produit >= 10, soustraire 9
            IF v_product >= 10 THEN
                v_product := v_product - 9;
            END IF;
            v_sum := v_sum + v_product;
        ELSE
            v_sum := v_sum + v_digit;
        END IF;
    END LOOP;

    -- La clé de Luhn : (10 - (somme % 10)) % 10
    RETURN (SUBSTRING(p_siren, v_len, 1)::INT = (10 - (v_sum % 10)) % 10);
END;
$$;

COMMENT ON FUNCTION public.validate_luhn_siren IS
'Valide la clé de Luhn d''un SIREN (9 chiffres).';

-- ─────────────────────────────────────────────────────────────
-- 5. FONCTION UTILITAIRE : Affichage du type de client
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_client_type_label(p_type public.client_type)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$
    SELECT CASE
        WHEN p_type = 'professionnel'::public.client_type THEN 'Professionnel'
        WHEN p_type = 'particulier'::public.client_type THEN 'Particulier'
        ELSE 'Inconnu'
    END;
$$;

COMMENT ON FUNCTION public.get_client_type_label IS
'Retourne le libellé français du type de client.';

-- ─────────────────────────────────────────────────────────────
-- 6. FONCTION UTILITAIRE : Nom d'affichage du client
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_client_display_name(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client RECORD;
    v_display TEXT;
BEGIN
    SELECT type, company_name, first_name, last_name, civility, nom
    INTO v_client
    FROM public.clients
    WHERE id = p_client_id;

    IF NOT FOUND THEN
        RETURN 'Client inconnu';
    END IF;

    -- Pour les professionnels : afficher company_name
    IF v_client.type = 'professionnel'::public.client_type THEN
        RETURN COALESCE(v_client.company_name, v_client.nom, '—');
    ELSE
        -- Pour les particuliers : afficher Prénom Nom (avec civility optionnelle)
        v_display := COALESCE(v_client.first_name || ' ' || v_client.last_name, v_client.nom);
        IF v_client.civility IS NOT NULL THEN
            v_display := v_client.civility || ' ' || v_display;
        END IF;
        RETURN v_display;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.get_client_display_name IS
'Retourne le nom d''affichage du client selon son type.';

GRANT EXECUTE ON FUNCTION public.get_client_display_name(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. FONCTION UTILITAIRE : Générer les mentions légales
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_legal_notices(p_client_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client RECORD;
    v_notices TEXT;
BEGIN
    SELECT type, is_canvassing
    INTO v_client
    FROM public.clients
    WHERE id = p_client_id;

    IF NOT FOUND THEN
        RETURN '';
    END IF;

    v_notices := '';

    -- Pour les particuliers uniquement
    IF v_client.type = 'particulier'::public.client_type THEN
        v_notices := v_notices || 'Garantie légale de conformité : Article L217-3 et suivants du Code de la consommation (durée 2 ans). ' ||
                                   'Garantie des vices cachés : Articles 1641 et suivants du Code civil. ';

        -- Si le client est un cas de démarchage à domicile
        IF v_client.is_canvassing = true THEN
            v_notices := v_notices || 'Droit de rétractation : 14 jours à compter de la conclusion du contrat (Article L221-18 du Code de la consommation).';
        END IF;
    END IF;

    RETURN TRIM(v_notices);
END;
$$;

COMMENT ON FUNCTION public.get_legal_notices IS
'Retourne les mentions légales (garanties, droit de rétractation) selon le type de client.';

GRANT EXECUTE ON FUNCTION public.get_legal_notices(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. GRANT des permissions aux functions
-- ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.validate_luhn_siren(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_type_label(public.client_type) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. MIGRATION HISTORIQUE (clients existants)
-- ─────────────────────────────────────────────────────────────
-- Les clients existants sont initialisés avec type='professionnel' (par défaut)
-- car ils proviennent du système actuel basé sur les artisans.
-- Aucune action manuelle requise.

COMMENT ON COLUMN public.clients.type IS
'Type de client : "professionnel" ou "particulier". Détermine les champs requis et le rendu dans les devis/factures.';

COMMENT ON COLUMN public.clients.company_name IS
'Dénomination sociale (PROFESSIONNEL uniquement).';

COMMENT ON COLUMN public.clients.siren IS
'Numéro SIREN 9 chiffres (PROFESSIONNEL, OBLIGATOIRE depuis 2026).';

COMMENT ON COLUMN public.clients.siret IS
'Numéro SIRET 14 chiffres (PROFESSIONNEL, optionnel si siège différent).';

COMMENT ON COLUMN public.clients.vat_number IS
'N° TVA intracommunautaire (PROFESSIONNEL, optionnel si assujetti TVA).';

COMMENT ON COLUMN public.clients.legal_form IS
'Forme juridique : SARL, SAS, SASU, EURL, SA, auto-entrepreneur, etc. (PROFESSIONNEL, optionnel).';

COMMENT ON COLUMN public.clients.contact_name IS
'Nom du contact dans l''entreprise (PROFESSIONNEL, optionnel).';

COMMENT ON COLUMN public.clients.service_address IS
'Adresse de livraison si différente de l''adresse facturation (PROFESSIONNEL, optionnel).';

COMMENT ON COLUMN public.clients.first_name IS
'Prénom du client (PARTICULIER, OBLIGATOIRE).';

COMMENT ON COLUMN public.clients.last_name IS
'Nom du client (PARTICULIER, OBLIGATOIRE).';

COMMENT ON COLUMN public.clients.civility IS
'Civilité : M., Mme, autre (PARTICULIER, optionnel).';

COMMENT ON COLUMN public.clients.is_canvassing IS
'Vrai si le client est un cas de démarchage à domicile. Déclenche l''affichage du droit de rétractation 14j (PARTICULIER).';

COMMENT ON COLUMN public.clients.country IS
'Pays de résidence/siège (défaut: "France").';

-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
