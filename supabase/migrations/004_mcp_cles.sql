-- Clés d'accès au serveur MCP (ChatGPT). Une clé = un compte, valable uniquement sur /api/mcp.
-- Seul le hash SHA-256 est stocké : la clé en clair n'est montrée qu'une fois à la création.

CREATE TABLE IF NOT EXISTS public.mcp_cles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom                   TEXT NOT NULL DEFAULT 'ChatGPT',
  prefixe               TEXT NOT NULL,            -- 8 premiers caractères, pour l'affichage
  cle_hash              TEXT NOT NULL UNIQUE,
  derniere_utilisation  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_cles_user_id ON public.mcp_cles(user_id);

ALTER TABLE public.mcp_cles ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur gère uniquement ses propres clés (révoquer = supprimer)
CREATE POLICY "proprio_select_mcp_cles" ON public.mcp_cles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "proprio_insert_mcp_cles" ON public.mcp_cles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "proprio_delete_mcp_cles" ON public.mcp_cles
  FOR DELETE USING (auth.uid() = user_id);

-- Les colonnes sensibles ne sont pas modifiables par l'utilisateur ; le serveur MCP
-- (service_role) met à jour derniere_utilisation.
REVOKE ALL ON public.mcp_cles FROM anon;
GRANT SELECT, INSERT, DELETE ON public.mcp_cles TO authenticated;

-- Le serveur MCP (clé service_role) appelle ces fonctions, toujours avec l'id du compte de la clé
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_numero(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.convertir_devis_en_facture(UUID, UUID) TO service_role;
