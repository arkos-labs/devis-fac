// Téléchargement d'un PDF de devis via un lien temporaire signé (voir _pdf-link.ts),
// émis par l'outil MCP telecharger_pdf_devis.
import { createClient } from '@supabase/supabase-js'
import { genererPdfDevis } from './_devis-pdf.js'
import { verifyPdfToken } from './_pdf-link.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export async function GET(req: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response('Serveur non configuré.', { status: 500 })

  const token = new URL(req.url).searchParams.get('t') ?? ''
  const claims = await verifyPdfToken(SERVICE_ROLE_KEY, token)
  if (!claims) return new Response('Lien invalide ou expiré.', { status: 403 })

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const res = await genererPdfDevis(db, claims.userId, claims.devisId)
  if (!res.ok) return new Response(res.erreur, { status: 404 })

  return new Response(res.bytes as BlobPart, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${res.filename}"`,
      'cache-control': 'private, no-store',
    },
  })
}
