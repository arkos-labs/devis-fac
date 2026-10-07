-- Options avancées des clés MCP : portée (lecture seule / complet), expiration, journal d'activité.
-- Le serveur MCP fonctionne sans cette migration (clés « complet » sans expiration, pas de journal),
-- mais la page Paramètres et ces options en ont besoin.

-- ── Portée et expiration des clés ────────────────────────────
ALTER TABLE public.mcp_cles
  ADD COLUMN IF NOT EXISTS portee    TEXT NOT NULL DEFAULT 'complet',
  ADD COLUMN IF NOT EXISTS expire_le TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mcp_cles_portee_check') THEN
    ALTER TABLE public.mcp_cles
      ADD CONSTRAINT mcp_cles_portee_check CHECK (portee IN ('lecture', 'complet'));
  END IF;
END $$;

-- ── Journal d'activité : ce que l'IA a créé / modifié ────────
CREATE TABLE IF NOT EXISTS public.mcp_journal (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cle_id      UUID REFERENCES public.mcp_cles(id) ON DELETE SET NULL,
  outil       TEXT NOT NULL,
  resume      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_journal_user_date ON public.mcp_journal(user_id, created_at DESC);

ALTER TABLE public.mcp_journal ENABLE ROW LEVEL SECURITY;

-- Chacun lit uniquement son journal ; seule l'écriture par le serveur (service_role) est possible.
CREATE POLICY "proprio_select_mcp_journal" ON public.mcp_journal
  FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON public.mcp_journal FROM anon, authenticated;
GRANT SELECT ON public.mcp_journal TO authenticated;
GRANT SELECT, INSERT ON public.mcp_journal TO service_role;

NOTIFY pgrst, 'reload schema';
