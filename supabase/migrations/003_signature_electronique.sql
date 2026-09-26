-- ============================================================
-- MIGRATION — Signature électronique des devis
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Colonnes signature sur devis ──────────────────────────
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS signature_activee BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_token    UUID NOT NULL DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS signature_date      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_nom_signataire TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_devis_signature_token'
  ) THEN
    ALTER TABLE public.devis ADD CONSTRAINT uq_devis_signature_token UNIQUE (signature_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_devis_signature_token ON public.devis(signature_token);

-- ── 2. Étendre les statuts possibles pour accepter 'signe' ───
-- (on préserve toutes les valeurs déjà en usage en prod, dont 'facture')
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.devis'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%statut%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.devis DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE public.devis ADD CONSTRAINT devis_statut_check
    CHECK (statut IN ('en_attente', 'accepte', 'refuse', 'expire', 'facture', 'signe'));
END $$;

-- ── 3. Fonction publique : lire un devis via son token de signature ──
CREATE OR REPLACE FUNCTION public.get_devis_signature(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_devis   RECORD;
  v_result  JSON;
BEGIN
  SELECT * INTO v_devis
  FROM public.devis
  WHERE signature_token = p_token AND signature_activee = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'introuvable');
  END IF;

  SELECT json_build_object(
    'success', true,
    'devis', json_build_object(
      'id', v_devis.id,
      'numero', v_devis.numero,
      'titre', v_devis.titre,
      'statut', v_devis.statut,
      'date_creation', v_devis.date_creation,
      'date_validite', v_devis.date_validite,
      'montant_ht', v_devis.montant_ht,
      'montant_total', v_devis.montant_total,
      'notes_client', v_devis.notes_client,
      'signature_date', v_devis.signature_date,
      'signature_nom_signataire', v_devis.signature_nom_signataire,
      'note_google_snapshot', v_devis.note_google_snapshot,
      'nombre_avis_google_snapshot', v_devis.nombre_avis_google_snapshot
    ),
    'client', (
      SELECT json_build_object(
        'nom', c.nom, 'nom_entreprise', c.nom_entreprise, 'type_client', c.type_client,
        'email', c.email, 'telephone', c.telephone,
        'adresse', c.adresse, 'ville', c.ville, 'code_postal', c.code_postal,
        'siret', c.siret, 'tva_intracommunautaire', c.tva_intracommunautaire
      )
      FROM public.clients c WHERE c.id = v_devis.client_id
    ),
    'entreprise', (
      SELECT json_build_object(
        'nom_entreprise', p.nom_entreprise, 'logo_url', p.logo_url, 'signature_url', p.signature_url,
        'siret', p.siret, 'adresse_entreprise', p.adresse_entreprise,
        'telephone_entreprise', p.telephone_entreprise, 'email_entreprise', p.email_entreprise,
        'mentions_legales', p.mentions_legales, 'forme_juridique', p.forme_juridique,
        'tva_intracommunautaire', p.tva_intracommunautaire,
        'assujetti_tva', p.assujetti_tva, 'taux_tva', p.taux_tva,
        'afficher_avis_sur_devis', p.afficher_avis_sur_devis,
        'note_google', p.note_google, 'nombre_avis_google', p.nombre_avis_google,
        'avis_google_url', p.avis_google_url
      )
      FROM public.parametres_compte p WHERE p.user_id = v_devis.user_id
    ),
    'lignes', (
      SELECT COALESCE(json_agg(json_build_object(
        'description', l.description,
        'detail', l.detail,
        'ordre', l.ordre,
        'quantite', l.quantite,
        'unite', l.unite,
        'prix_unitaire', l.prix_unitaire,
        'montant_ligne', l.montant_ligne
      ) ORDER BY l.ordre), '[]'::json)
      FROM public.lignes_prestation l
      WHERE l.document_type = 'devis' AND l.document_id = v_devis.id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_devis_signature IS
'Accès public (anon) en lecture à un devis via son token de signature, uniquement si la signature électronique est activée.';

-- ── 4. Fonction publique : le client signe ou refuse le devis ──
CREATE OR REPLACE FUNCTION public.repondre_devis_signature(
  p_token    UUID,
  p_reponse  TEXT,  -- 'signe' ou 'refuse'
  p_nom      TEXT DEFAULT NULL  -- nom complet saisi par le client, requis si p_reponse = 'signe'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_devis RECORD;
BEGIN
  IF p_reponse NOT IN ('signe', 'refuse') THEN
    RETURN json_build_object('success', false, 'error', 'reponse_invalide');
  END IF;

  IF p_reponse = 'signe' AND (p_nom IS NULL OR btrim(p_nom) = '') THEN
    RETURN json_build_object('success', false, 'error', 'nom_requis');
  END IF;

  SELECT * INTO v_devis
  FROM public.devis
  WHERE signature_token = p_token AND signature_activee = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'introuvable');
  END IF;

  IF v_devis.statut <> 'en_attente' THEN
    RETURN json_build_object('success', false, 'error', 'deja_traite', 'statut', v_devis.statut);
  END IF;

  UPDATE public.devis
  SET statut = p_reponse,
      signature_date = now(),
      signature_nom_signataire = CASE WHEN p_reponse = 'signe' THEN btrim(p_nom) ELSE NULL END
  WHERE id = v_devis.id;

  RETURN json_build_object('success', true, 'statut', p_reponse);
END;
$$;

COMMENT ON FUNCTION public.repondre_devis_signature IS
'Permet à un client (accès anonyme via token) de signer (avec son nom complet en guise de signature) ou refuser un devis. Met à jour le statut automatiquement.';

-- ── 5. Grants ─────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_devis_signature(UUID)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repondre_devis_signature(UUID, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
