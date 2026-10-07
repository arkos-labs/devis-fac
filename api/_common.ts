// Éléments partagés par le serveur MCP (api/mcp.ts) et ses modules d'outils.
// Le préfixe « _ » empêche Vercel d'exposer ce fichier comme une route.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/** Contexte passé à chaque module d'outils : toujours borné au compte de la clé. */
export interface Ctx {
  server: McpServer
  db: SupabaseClient
  userId: string
  origin: string
}

export const MAX_LIMIT = 50
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }

// Colonnes exposées (liste blanche) : jamais notes internes, prompt IA, IBAN, paramètres…
export const CLIENT_COLS = 'id, type_client, nom, nom_entreprise, email, telephone, adresse, ville, code_postal, dernier_contact'
export const DEVIS_COLS = 'id, numero, titre, statut, montant_ht, montant_total, date_creation, date_validite, notes_client'
export const FACTURE_COLS = 'id, numero, titre, statut, montant_ht, montant_total, date_creation, date_echeance, date_paiement, moyen_paiement, notes_client'
export const LIGNE_COLS = 'ordre, description, detail, quantite, unite, prix_unitaire, montant_ligne'

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ')
export const ligneSchema = z.object({
  description: z.string().min(1).max(300),
  detail: z.string().max(1000).optional(),
  quantite: z.number().positive().max(100000).default(1),
  unite: z.string().max(20).default('forfait'),
  prix_unitaire: z.number().min(0).max(1000000),
})
export type Ligne = z.infer<typeof ligneSchema>

export const limitSchema = z.number().int().min(1).max(MAX_LIMIT).default(20)

export function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function fail(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: `Erreur : ${message}` }] }
}

// Retire les caractères qui casseraient un filtre PostgREST `.or(...)`.
export function cleanSearch(q: string) {
  return q.replace(/[,()%*\\]/g, ' ').trim()
}

export async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Même règle que l'application : créer/modifier des devis et factures nécessite un abonnement actif.
export async function requireSubscription(db: SupabaseClient, userId: string) {
  const { data } = await db.from('subscriptions').select('status').eq('user_id', userId).maybeSingle()
  return data?.status === 'active' || data?.status === 'trialing'
}

export const NO_SUBSCRIPTION = 'Abonnement requis pour créer ou modifier des devis ou factures.'

export async function clientAppartient(db: SupabaseClient, userId: string, clientId: string) {
  const { data } = await db.from('clients').select('id').eq('id', clientId).eq('user_id', userId).maybeSingle()
  return !!data
}

export async function insertLignes(db: SupabaseClient, userId: string, type: 'devis' | 'facture', docId: string, lignes: Ligne[]) {
  return db.from('lignes_prestation').insert(
    lignes.map((l, i) => ({
      user_id: userId,
      document_type: type,
      document_id: docId,
      ordre: i,
      description: l.description,
      detail: l.detail ?? null,
      quantite: l.quantite,
      unite: l.unite,
      prix_unitaire: l.prix_unitaire,
    })),
  )
}

export async function noteGoogle(db: SupabaseClient, userId: string) {
  const { data } = await db.from('parametres_compte').select('note_google, nombre_avis_google').eq('user_id', userId).maybeSingle()
  return { note_google_snapshot: data?.note_google ?? null, nombre_avis_google_snapshot: data?.nombre_avis_google ?? null }
}

export const estUuid = (v: string) => z.string().uuid().safeParse(v).success

/** Résout un id ou un numéro (D-0002 / F-0003) en document du compte, ou null. */
export async function trouverDocument<T extends string>(
  db: SupabaseClient,
  userId: string,
  table: 'devis' | 'factures',
  idOuNumero: string,
  colonnes: T,
) {
  const { data, error } = await db
    .from(table)
    .select(colonnes)
    .eq('user_id', userId)
    .eq(estUuid(idOuNumero) ? 'id' : 'numero', idOuNumero)
    .maybeSingle()
  return { data: data as unknown as Record<string, any> | null, error }
}

export const aujourdhui = () => new Date().toISOString().slice(0, 10)
export const arrondi2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
