-- Migration v2 - Ajout des clients professionnels

ALTER TABLE public.clients
ADD COLUMN type_client TEXT NOT NULL DEFAULT 'particulier' CHECK (type_client IN ('particulier', 'professionnel')),
ADD COLUMN nom_entreprise TEXT,
ADD COLUMN siret TEXT,
ADD COLUMN tva_intracommunautaire TEXT;

-- Index additionnel pour la recherche
CREATE INDEX IF NOT EXISTS idx_clients_entreprise ON public.clients(user_id, nom_entreprise);

ALTER TABLE public.devis
ADD COLUMN IF NOT EXISTS titre TEXT;
