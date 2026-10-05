// Serveur MCP du CRM (consultation + création de clients, devis et factures) — Streamable HTTP, sans état.
// Aucune modification ni suppression de l'existant n'est exposée.
// L'accès se fait avec une clé dédiée (table mcp_cles, stockée hachée) qui ne vaut
// QUE pour ce endpoint et QUE pour le compte qui l'a créée. Le serveur utilise la clé
// service_role, mais uniquement via les requêtes fixes ci-dessous : colonnes explicites,
// toujours filtrées par user_id.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const MAX_LIMIT = 50
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

// Colonnes exposées (liste blanche) : jamais notes internes, prompt IA, IBAN, paramètres…
const CLIENT_COLS = 'id, type_client, nom, nom_entreprise, email, telephone, adresse, ville, code_postal, dernier_contact'
const DEVIS_COLS = 'id, numero, titre, statut, montant_ht, montant_total, date_creation, date_validite, notes_client'
const FACTURE_COLS = 'id, numero, titre, statut, montant_ht, montant_total, date_creation, date_echeance, date_paiement, moyen_paiement, notes_client'
const LIGNE_COLS = 'ordre, description, detail, quantite, unite, prix_unitaire, montant_ligne'

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ')
const ligneSchema = z.object({
  description: z.string().min(1).max(300),
  detail: z.string().max(1000).optional(),
  quantite: z.number().positive().max(100000).default(1),
  unite: z.string().max(20).default('forfait'),
  prix_unitaire: z.number().min(0).max(1000000),
})
type Ligne = z.infer<typeof ligneSchema>

const limitSchema = z.number().int().min(1).max(MAX_LIMIT).default(20)

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function fail(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: `Erreur : ${message}` }] }
}

// Retire les caractères qui casseraient un filtre PostgREST `.or(...)`.
function cleanSearch(q: string) {
  return q.replace(/[,()%*\\]/g, ' ').trim()
}

async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Même règle que l'application : créer des devis/factures nécessite un abonnement actif.
async function requireSubscription(db: SupabaseClient, userId: string) {
  const { data } = await db.from('subscriptions').select('status').eq('user_id', userId).maybeSingle()
  return data?.status === 'active' || data?.status === 'trialing'
}

const NO_SUBSCRIPTION = 'Abonnement requis pour créer des devis ou factures.'

async function clientAppartient(db: SupabaseClient, userId: string, clientId: string) {
  const { data } = await db.from('clients').select('id').eq('id', clientId).eq('user_id', userId).maybeSingle()
  return !!data
}

async function insertLignes(db: SupabaseClient, userId: string, type: 'devis' | 'facture', docId: string, lignes: Ligne[]) {
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

async function noteGoogle(db: SupabaseClient, userId: string) {
  const { data } = await db.from('parametres_compte').select('note_google, nombre_avis_google').eq('user_id', userId).maybeSingle()
  return { note_google_snapshot: data?.note_google ?? null, nombre_avis_google_snapshot: data?.nombre_avis_google ?? null }
}

function buildServer(db: SupabaseClient, userId: string) {
  const server = new McpServer({ name: 'crm-nettoyage', version: '1.0.0' })

  server.registerTool(
    'rechercher_clients',
    {
      title: 'Rechercher des clients',
      description: 'Liste ou recherche des clients (nom, entreprise, email, ville). Sans requête, renvoie les plus récents.',
      inputSchema: { requete: z.string().max(100).optional(), limite: limitSchema },
      annotations: READ_ONLY,
    },
    async ({ requete, limite }) => {
      let q = db
        .from('clients')
        .select(CLIENT_COLS)
        .eq('user_id', userId)
        .order('date_creation', { ascending: false })
        .limit(limite)
      const s = requete ? cleanSearch(requete) : ''
      if (s) {
        q = q.or(`nom.ilike.%${s}%,nom_entreprise.ilike.%${s}%,email.ilike.%${s}%,ville.ilike.%${s}%`)
      }
      const { data, error } = await q
      return error ? fail(error.message) : json(data)
    },
  )

  server.registerTool(
    'obtenir_client',
    {
      title: "Détail d'un client",
      description: "Fiche d'un client avec ses devis et factures.",
      inputSchema: { client_id: z.string().uuid() },
      annotations: READ_ONLY,
    },
    async ({ client_id }) => {
      const [client, devis, factures] = await Promise.all([
        db.from('clients').select(CLIENT_COLS).eq('id', client_id).eq('user_id', userId).maybeSingle(),
        db.from('devis').select('id, numero, statut, montant_total, date_creation').eq('client_id', client_id).eq('user_id', userId).order('date_creation', { ascending: false }),
        db.from('factures').select('id, numero, statut, montant_total, date_creation, date_echeance').eq('client_id', client_id).eq('user_id', userId).order('date_creation', { ascending: false }),
      ])
      if (client.error) return fail(client.error.message)
      if (!client.data) return fail('Client introuvable.')
      return json({ client: client.data, devis: devis.data ?? [], factures: factures.data ?? [] })
    },
  )

  server.registerTool(
    'lister_devis',
    {
      title: 'Lister les devis',
      description: 'Liste les devis, filtrables par statut et par client.',
      inputSchema: {
        statut: z.enum(['en_attente', 'accepte', 'refuse', 'expire']).optional(),
        client_id: z.string().uuid().optional(),
        limite: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async ({ statut, client_id, limite }) => {
      let q = db
        .from('devis')
        .select('id, numero, titre, statut, montant_total, date_creation, date_validite, clients(nom, nom_entreprise)')
        .eq('user_id', userId)
        .order('date_creation', { ascending: false })
        .limit(limite)
      if (statut) q = q.eq('statut', statut)
      if (client_id) q = q.eq('client_id', client_id)
      const { data, error } = await q
      return error ? fail(error.message) : json(data)
    },
  )

  server.registerTool(
    'obtenir_devis',
    {
      title: "Détail d'un devis",
      description: "Un devis avec son client et ses lignes de prestation. Accepte l'id ou le numéro (ex. D-0085).",
      inputSchema: { id_ou_numero: z.string().min(1).max(64) },
      annotations: READ_ONLY,
    },
    async ({ id_ou_numero }) => {
      const byId = z.string().uuid().safeParse(id_ou_numero).success
      const { data, error } = await db
        .from('devis')
        .select(`${DEVIS_COLS}, clients(nom, nom_entreprise, email, telephone)`)
        .eq('user_id', userId)
        .eq(byId ? 'id' : 'numero', id_ou_numero)
        .maybeSingle()
      if (error) return fail(error.message)
      if (!data) return fail('Devis introuvable.')
      const lignes = await db
        .from('lignes_prestation')
        .select(LIGNE_COLS)
        .eq('user_id', userId)
        .eq('document_type', 'devis')
        .eq('document_id', (data as { id: string }).id)
        .order('ordre')
      return json({ ...data, lignes: lignes.data ?? [] })
    },
  )

  server.registerTool(
    'lister_factures',
    {
      title: 'Lister les factures',
      description: 'Liste les factures, filtrables par statut et par client.',
      inputSchema: {
        statut: z.enum(['en_attente', 'payee', 'retard', 'annulee']).optional(),
        client_id: z.string().uuid().optional(),
        limite: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async ({ statut, client_id, limite }) => {
      let q = db
        .from('factures')
        .select('id, numero, titre, statut, montant_total, date_creation, date_echeance, date_paiement, clients(nom, nom_entreprise)')
        .eq('user_id', userId)
        .order('date_creation', { ascending: false })
        .limit(limite)
      if (statut) q = q.eq('statut', statut)
      if (client_id) q = q.eq('client_id', client_id)
      const { data, error } = await q
      return error ? fail(error.message) : json(data)
    },
  )

  server.registerTool(
    'obtenir_facture',
    {
      title: "Détail d'une facture",
      description: "Une facture avec son client et ses lignes de prestation. Accepte l'id ou le numéro (ex. F-0085).",
      inputSchema: { id_ou_numero: z.string().min(1).max(64) },
      annotations: READ_ONLY,
    },
    async ({ id_ou_numero }) => {
      const byId = z.string().uuid().safeParse(id_ou_numero).success
      const { data, error } = await db
        .from('factures')
        .select(`${FACTURE_COLS}, clients(nom, nom_entreprise, email, telephone)`)
        .eq('user_id', userId)
        .eq(byId ? 'id' : 'numero', id_ou_numero)
        .maybeSingle()
      if (error) return fail(error.message)
      if (!data) return fail('Facture introuvable.')
      const lignes = await db
        .from('lignes_prestation')
        .select(LIGNE_COLS)
        .eq('user_id', userId)
        .eq('document_type', 'facture')
        .eq('document_id', (data as { id: string }).id)
        .order('ordre')
      return json({ ...data, lignes: lignes.data ?? [] })
    },
  )

  server.registerTool(
    'factures_impayees',
    {
      title: 'Factures impayées',
      description: 'Factures en attente ou en retard, avec le total restant à encaisser.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const { data, error } = await db
        .from('factures')
        .select('id, numero, statut, montant_total, date_echeance, clients(nom, nom_entreprise, email, telephone)')
        .eq('user_id', userId)
        .in('statut', ['en_attente', 'retard'])
        .order('date_echeance', { ascending: true })
        .limit(200)
      if (error) return fail(error.message)
      const total = (data ?? []).reduce((s, f) => s + Number(f.montant_total), 0)
      return json({ total_a_encaisser: total, nombre: data?.length ?? 0, factures: data })
    },
  )

  server.registerTool(
    'statistiques',
    {
      title: 'Statistiques du tableau de bord',
      description: "CA du mois et de l'année, CA à venir, taux d'acceptation des devis, factures en retard, nombre de clients.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const { data, error } = await db.rpc('get_dashboard_stats', { p_user_id: userId })
      return error ? fail(error.message) : json(data)
    },
  )

  server.registerTool(
    'creer_client',
    {
      title: 'Créer un client',
      description: 'Ajoute un nouveau client (particulier ou professionnel).',
      inputSchema: {
        nom: z.string().min(1).max(200),
        type_client: z.enum(['particulier', 'professionnel']).default('particulier'),
        nom_entreprise: z.string().max(200).optional(),
        email: z.string().email().max(200).optional(),
        telephone: z.string().max(30).optional(),
        adresse: z.string().max(300).optional(),
        ville: z.string().max(100).optional(),
        code_postal: z.string().max(10).optional(),
        notes: z.string().max(2000).optional(),
      },
      annotations: WRITE,
    },
    async (input) => {
      const { data, error } = await db
        .from('clients')
        .insert({ ...input, user_id: userId })
        .select(CLIENT_COLS)
        .single()
      return error ? fail(error.message) : json({ cree: true, client: data })
    },
  )

  server.registerTool(
    'creer_devis',
    {
      title: 'Créer un devis',
      description: 'Crée un devis (statut en attente) pour un client existant, avec ses lignes de prestation. Le numéro est attribué automatiquement.',
      inputSchema: {
        client_id: z.string().uuid(),
        titre: z.string().max(200).optional(),
        date_validite: dateSchema.optional(),
        notes_client: z.string().max(2000).optional(),
        lignes: z.array(ligneSchema).min(1).max(50),
      },
      annotations: WRITE,
    },
    async ({ client_id, titre, date_validite, notes_client, lignes }) => {
      if (!(await requireSubscription(db, userId))) return fail(NO_SUBSCRIPTION)
      if (!(await clientAppartient(db, userId, client_id))) return fail('Client introuvable.')

      const { data: numero, error: numErr } = await db.rpc('get_next_numero', { p_user_id: userId, p_type: 'devis' })
      if (numErr) return fail(numErr.message)

      const { data: devis, error } = await db
        .from('devis')
        .insert({
          user_id: userId,
          client_id,
          numero: numero as string,
          titre: titre ?? null,
          date_validite: date_validite ?? null,
          notes_client: notes_client ?? null,
          statut: 'en_attente',
          genere_par_ia: true,
          ...(await noteGoogle(db, userId)),
        })
        .select('id, numero')
        .single()
      if (error) return fail(error.message)

      const { error: lErr } = await insertLignes(db, userId, 'devis', devis.id, lignes)
      if (lErr) {
        await db.from('devis').delete().eq('id', devis.id).eq('user_id', userId)
        return fail(lErr.message)
      }
      const total = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0)
      return json({ cree: true, id: devis.id, numero: devis.numero, montant_total: total })
    },
  )

  server.registerTool(
    'creer_facture',
    {
      title: 'Créer une facture',
      description: 'Crée une facture (statut en attente) pour un client existant, avec ses lignes de prestation. Le numéro est attribué automatiquement. Pour facturer un devis existant, préférer convertir_devis_en_facture.',
      inputSchema: {
        client_id: z.string().uuid(),
        titre: z.string().max(200).optional(),
        date_echeance: dateSchema.optional(),
        notes_client: z.string().max(2000).optional(),
        lignes: z.array(ligneSchema).min(1).max(50),
      },
      annotations: WRITE,
    },
    async ({ client_id, titre, date_echeance, notes_client, lignes }) => {
      if (!(await requireSubscription(db, userId))) return fail(NO_SUBSCRIPTION)
      if (!(await clientAppartient(db, userId, client_id))) return fail('Client introuvable.')

      const { data: numero, error: numErr } = await db.rpc('get_next_numero', { p_user_id: userId, p_type: 'facture' })
      if (numErr) return fail(numErr.message)

      // Total injecté dès la création : la facture est inaltérable ensuite (comme dans l'application).
      const total = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0)
      const { data: facture, error } = await db
        .from('factures')
        .insert({
          user_id: userId,
          client_id,
          devis_id: null,
          numero: numero as string,
          titre: titre ?? null,
          date_echeance: date_echeance ?? null,
          notes_client: notes_client ?? null,
          statut: 'en_attente',
          montant_ht: total,
          montant_total: total,
          ...(await noteGoogle(db, userId)),
        })
        .select('id, numero')
        .single()
      if (error) return fail(error.message)

      const { error: lErr } = await insertLignes(db, userId, 'facture', facture.id, lignes)
      if (lErr) {
        await db.from('factures').delete().eq('id', facture.id).eq('user_id', userId)
        return fail(lErr.message)
      }
      return json({ cree: true, id: facture.id, numero: facture.numero, montant_total: total })
    },
  )

  server.registerTool(
    'convertir_devis_en_facture',
    {
      title: 'Convertir un devis en facture',
      description: "Crée la facture correspondant à un devis existant (échéance à 30 jours) et marque le devis comme accepté. Un devis ne peut être converti qu'une fois.",
      inputSchema: { devis_id: z.string().uuid() },
      annotations: WRITE,
    },
    async ({ devis_id }) => {
      if (!(await requireSubscription(db, userId))) return fail(NO_SUBSCRIPTION)
      const { data, error } = await db.rpc('convertir_devis_en_facture', { p_devis_id: devis_id, p_user_id: userId })
      if (error) return fail(error.message)
      const { data: f } = await db.from('factures').select('id, numero, montant_total').eq('id', data as string).eq('user_id', userId).maybeSingle()
      return json({ cree: true, facture: f })
    },
  )

  return server
}

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: 'unauthorized', error_description: message }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer' },
  })
}

async function handle(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response('Serveur MCP non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).', { status: 500 })
  }

  const token = /^Bearer (.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1]?.trim()
  if (!token || !token.startsWith('crm_')) return unauthorized('Clé manquante ou invalide.')

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: cle, error } = await db
    .from('mcp_cles')
    .select('id, user_id')
    .eq('cle_hash', await sha256Hex(token))
    .maybeSingle()
  if (error || !cle) return unauthorized('Clé inconnue ou révoquée.')

  // Trace d'utilisation (sans bloquer la réponse en cas d'échec)
  await db.from('mcp_cles').update({ derniere_utilisation: new Date().toISOString() }).eq('id', cle.id)

  const server = buildServer(db, cle.user_id as string)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // sans état : une instance par requête
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(req)
}

export const GET = handle
export const POST = handle
export const DELETE = handle
