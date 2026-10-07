// Liens de téléchargement PDF temporaires, signés (HMAC-SHA256) avec la clé service_role
// déjà présente côté serveur : aucune nouvelle variable d'environnement, aucun stockage.
// Le lien est un secret porteur : quiconque l'a peut télécharger CE PDF jusqu'à son expiration.

export const PDF_LINK_TTL_S = 15 * 60

export type TypeDocLien = 'devis' | 'facture'

const enc = new TextEncoder()

function b64url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url')
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))))
}

export async function signPdfToken(secret: string, userId: string, docId: string, type: TypeDocLien = 'devis') {
  const payload = b64url(
    enc.encode(JSON.stringify({ u: userId, d: docId, t: type, e: Math.floor(Date.now() / 1000) + PDF_LINK_TTL_S })),
  )
  return `${payload}.${await hmac(secret, payload)}`
}

export async function verifyPdfToken(
  secret: string,
  token: string,
): Promise<{ userId: string; docId: string; type: TypeDocLien } | null> {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const attendu = await hmac(secret, payload)
  if (attendu.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= attendu.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return null
  try {
    const { u, d, t, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof u !== 'string' || typeof d !== 'string' || typeof e !== 'number') return null
    if (e < Math.floor(Date.now() / 1000)) return null
    return { userId: u, docId: d, type: t === 'facture' ? 'facture' : 'devis' }
  } catch {
    return null
  }
}
