// Outils MCP « étendus » : PDF, statuts, paiements, acomptes, signature, e-mail, relances,
// recherche, rapports, journal. Tous bornés au compte de la clé (ctx.userId).
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  CLIENT_COLS,
  NO_SUBSCRIPTION,
  READ_ONLY,
  SERVICE_ROLE_KEY,
  WRITE,
  aujourdhui,
  arrondi2,
  cleanSearch,
  dateSchema,
  fail,
  insertLignes,
  json,
  limitSchema,
  noteGoogle,
  requireSubscription,
  trouverDocument,
  type Ctx,
} from './_common.js'
import { genererPdfDocument, type TypeDocument } from './_documents-pdf.js'
import { PDF_LINK_TTL_S, signPdfToken } from './_pdf-link.js'

// ─────────────────────────────────────────────────────────────
// Fonctions métier réutilisées par api/mcp.ts
// ─────────────────────────────────────────────────────────────

/** Mêmes indicateurs que la fonction SQL get_dashboard_stats, calculés ici (aucune fonction SQL requise). */
export async function calculerStatistiques(db: SupabaseClient, userId: string) {
  const now = new Date()
  const debutAnnee = `${now.getUTCFullYear()}-01-01T00:00:00Z`
  const moisCourant = now.toISOString().slice(0, 7)
  const compte = (table: string, filtre: (q: any) => any) =>
    filtre(db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId))

  const [payees, aVenir, devisTraites, devisAttente, retard, clients] = await Promise.all([
    db.from('factures').select('montant_total, date_paiement').eq('user_id', userId).eq('statut', 'payee').gte('date_paiement', debutAnnee).limit(10000),
    db.from('factures').select('montant_total').eq('user_id', userId).eq('statut', 'en_attente').limit(10000),
    db.from('devis').select('statut').eq('user_id', userId).in('statut', ['accepte', 'refuse']).limit(10000),
    compte('devis', (q) => q.eq('statut', 'en_attente')),
    compte('factures', (q) => q.eq('statut', 'retard')),
    compte('clients', (q) => q),
  ])
  for (const r of [payees, aVenir, devisTraites, devisAttente, retard, clients]) if (r.error) throw new Error(r.error.message)

  const somme = (rows: { montant_total: number }[]) => arrondi2(rows.reduce((s, r) => s + Number(r.montant_total), 0))
  const payeesRows = (payees.data ?? []) as { montant_total: number; date_paiement: string }[]
  const traites = devisTraites.data ?? []
  const acceptes = traites.filter((d) => d.statut === 'accepte').length
  return {
    ca_mois_courant: somme(payeesRows.filter((r) => String(r.date_paiement).slice(0, 7) === moisCourant)),
    ca_annee_courante: somme(payeesRows),
    ca_a_venir: somme((aVenir.data ?? []) as { montant_total: number }[]),
    taux_acceptation_devis: traites.length ? Math.round((acceptes * 1000) / traites.length) / 10 : 0,
    devis_en_attente: devisAttente.count ?? 0,
    factures_en_retard: retard.count ?? 0,
    total_clients: clients.count ?? 0,
  }
}

type ResultatConversion =
  | { ok: true; facture: { id: string; numero: string; montant_total: number }; avertissement?: string }
  | { ok: false; erreur: string }

/**
 * Convertit un devis accepté (ou signé) en facture, avec la même logique que la fonction SQL de
 * l'application : numéro suivant, lignes copiées, échéance à 30 jours, devis passé en « facture ».
 */
export async function convertirDevisEnFacture(db: SupabaseClient, userId: string, devisId: string): Promise<ResultatConversion> {
  const { data: devis, error } = await db.from('devis').select('*').eq('id', devisId).eq('user_id', userId).maybeSingle()
  if (error) return { ok: false, erreur: error.message }
  if (!devis) return { ok: false, erreur: 'Devis introuvable.' }
  if (!['accepte', 'signe'].includes(devis.statut)) {
    return { ok: false, erreur: `Le devis ${devis.numero} est « ${devis.statut} » : seul un devis accepté ou signé peut être converti.` }
  }

  const { count } = await db
    .from('factures')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('devis_id', devisId)
    .neq('statut', 'annulee')
  if (count) return { ok: false, erreur: `Le devis ${devis.numero} a déjà été converti en facture.` }

  const { data: lignes, error: lErr } = await db
    .from('lignes_prestation')
    .select('*')
    .eq('user_id', userId)
    .eq('document_type', 'devis')
    .eq('document_id', devisId)
    .order('ordre')
  if (lErr) return { ok: false, erreur: lErr.message }
  if (!lignes?.length) return { ok: false, erreur: `Le devis ${devis.numero} n'a aucune ligne.` }

  const total = arrondi2(lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prix_unitaire), 0))
  const { data: numero, error: nErr } = await db.rpc('mcp_next_numero', { p_user_id: userId, p_type: 'facture' })
  if (nErr) return { ok: false, erreur: nErr.message }

  const echeance = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const { data: facture, error: fErr } = await db
    .from('factures')
    .insert({
      user_id: userId,
      client_id: devis.client_id,
      devis_id: devisId,
      numero: numero as string,
      statut: 'en_attente',
      date_echeance: echeance,
      notes_client: devis.notes_client,
      notes_internes: devis.notes_internes,
      titre: devis.titre,
      montant_ht: total,
      montant_total: total,
      ...(await noteGoogle(db, userId)),
    })
    .select('id, numero')
    .single()
  if (fErr) return { ok: false, erreur: fErr.message }

  const { error: iErr } = await db.from('lignes_prestation').insert(
    lignes.map((l) => ({
      user_id: userId,
      document_type: 'facture',
      document_id: facture.id,
      ordre: l.ordre,
      description: l.description,
      detail: l.detail,
      quantite: l.quantite,
      unite: l.unite,
      prix_unitaire: l.prix_unitaire,
      is_upsell: l.is_upsell ?? false,
    })),
  )
  if (iErr) {
    await db.from('factures').delete().eq('id', facture.id).eq('user_id', userId)
    return { ok: false, erreur: iErr.message }
  }

  const { error: uErr } = await db.from('devis').update({ statut: 'facture' }).eq('id', devisId).eq('user_id', userId)
  return {
    ok: true,
    facture: { id: facture.id, numero: facture.numero, montant_total: total },
    avertissement: uErr ? `Facture créée, mais le statut du devis n'a pas pu être mis à jour : ${uErr.message}` : undefined,
  }
}

// ─────────────────────────────────────────────────────────────
// Enregistrement des outils
// ─────────────────────────────────────────────────────────────

const MOYENS = ['virement', 'cheque', 'especes', 'carte', 'autre'] as const

function nettoyer<T extends Record<string, unknown>>(champs: T) {
  return Object.fromEntries(Object.entries(champs).filter(([, v]) => v !== undefined))
}

export function enregistrerOutilsEtendus(ctx: Ctx) {
  const { server, db, userId, origin } = ctx

  // ── PDF devis / facture ────────────────────────────────────
  const outilPdf = (type: TypeDocument) => {
    const table = type === 'devis' ? 'devis' : 'factures'
    const exemple = type === 'devis' ? 'D-0002' : 'F-0003'
    server.registerTool(
      type === 'devis' ? 'telecharger_pdf_devis' : 'telecharger_pdf_facture',
      {
        title: type === 'devis' ? "Obtenir le PDF d'un devis" : "Obtenir le PDF d'une facture",
        description:
          type === 'devis'
            ? "Génère le PDF d'un devis (identique à celui du bouton « Télécharger » du site, signature électronique incluse si présente). Renvoie le fichier en pièce jointe PDF (ressource encodée) ET un lien de téléchargement temporaire (valable 15 minutes). Accepte l'id ou le numéro (ex. D-0002)."
            : "Génère le PDF d'une facture au format Factur-X (identique au bouton « Télécharger » du site : PDF avec XML électronique embarqué). Renvoie le fichier en pièce jointe PDF (ressource encodée) ET un lien de téléchargement temporaire (valable 15 minutes). Accepte l'id ou le numéro (ex. F-0003).",
        inputSchema: { id_ou_numero: z.string().min(1).max(64) },
        annotations: READ_ONLY,
      },
      async ({ id_ou_numero }) => {
        const { data, error } = await trouverDocument(db, userId, table, id_ou_numero, 'id')
        if (error) return fail(error.message)
        if (!data) return fail(`${type === 'devis' ? 'Devis' : 'Facture'} introuvable (ex. ${exemple}).`)

        const pdf = await genererPdfDocument(db, userId, type, data.id)
        if (!pdf.ok) return fail(pdf.erreur)

        const token = await signPdfToken(SERVICE_ROLE_KEY, userId, data.id, type)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  document: pdf.numero,
                  fichier: pdf.filename,
                  format: pdf.facturX ? 'PDF Factur-X' : 'PDF',
                  taille_octets: pdf.bytes.length,
                  lien_telechargement: `${origin}/api/pdf?t=${token}`,
                  lien_valable_minutes: PDF_LINK_TTL_S / 60,
                  note: "Le PDF est aussi joint à cette réponse. Le lien est secret : ne le partager qu'avec le destinataire voulu.",
                },
                null,
                2,
              ),
            },
            {
              type: 'resource' as const,
              resource: { uri: `crm://${pdf.filename}`, mimeType: 'application/pdf', blob: Buffer.from(pdf.bytes).toString('base64') },
            },
          ],
        }
      },
    )
  }
  outilPdf('devis')
  outilPdf('facture')

  // ── Clients ────────────────────────────────────────────────
  server.registerTool(
    'modifier_client',
    {
      title: 'Modifier un client',
      description:
        "Modifie les coordonnées d'un client existant (nom, type, entreprise, email, téléphone, adresse, ville, code postal, notes). Les champs omis restent inchangés ; passer null pour effacer un champ. Ne touche ni aux devis ni aux factures du client.",
      inputSchema: {
        client_id: z.string().uuid(),
        nom: z.string().min(1).max(200).optional(),
        type_client: z.enum(['particulier', 'professionnel']).optional(),
        nom_entreprise: z.string().max(200).nullable().optional(),
        email: z.string().email().max(200).nullable().optional(),
        telephone: z.string().max(30).nullable().optional(),
        adresse: z.string().max(300).nullable().optional(),
        ville: z.string().max(100).nullable().optional(),
        code_postal: z.string().max(10).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ client_id, ...champs }) => {
      const maj = nettoyer(champs)
      if (!Object.keys(maj).length) return fail('Aucune modification demandée.')
      const { data, error } = await db
        .from('clients')
        .update(maj)
        .eq('id', client_id)
        .eq('user_id', userId)
        .select(CLIENT_COLS)
        .maybeSingle()
      if (error) return fail(error.message)
      return data ? json({ modifie: true, client: data }) : fail('Client introuvable.')
    },
  )

  // ── Statut des devis ───────────────────────────────────────
  server.registerTool(
    'changer_statut_devis',
    {
      title: "Changer le statut d'un devis",
      description:
        "Passe un devis à « accepte », « refuse », « expire » ou « en_attente ». Impossible pour un devis déjà signé électroniquement ou facturé. Un devis « accepte » peut ensuite être converti en facture ou donner lieu à un acompte.",
      inputSchema: {
        id_ou_numero: z.string().min(1).max(64),
        statut: z.enum(['en_attente', 'accepte', 'refuse', 'expire']),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ id_ou_numero, statut }) => {
      if (!(await requireSubscription(db, userId))) return fail(NO_SUBSCRIPTION)
      const { data: devis, error } = await trouverDocument(db, userId, 'devis', id_ou_numero, 'id, numero, statut')
      if (error) return fail(error.message)
      if (!devis) return fail('Devis introuvable.')
      if (['signe', 'facture'].includes(devis.statut)) {
        return fail(`Le devis ${devis.numero} est « ${devis.statut} » : son statut ne peut plus être changé.`)
      }
      if (devis.statut === statut) return json({ modifie: false, message: `Le devis ${devis.numero} est déjà « ${statut} ».` })
      const { error: uErr } = await db.from('devis').update({ statut }).eq('id', devis.id).eq('user_id', userId)
      return uErr ? fail(uErr.message) : json({ modifie: true, devis: devis.numero, ancien_statut: devis.statut, nouveau_statut: statut })
    },
  )

  // ── Conversion devis → facture (sans fonction SQL dédiée) ──
  server.registerTool(
    'convertir_devis_en_facture',
    {
      title: 'Convertir un devis en facture',
      description:
        "Crée la facture d'un devis « accepté » ou « signé » (lignes copiées, échéance à 30 jours) ; le devis passe alors au statut « facture ». Un devis ne peut être converti qu'une fois. Pour facturer seulement une partie (acompte), utiliser creer_facture_acompte.",
      inputSchema: { id_ou_numero: z.string().min(1).max(64) },
      annotations: WRITE,
    },
    async ({ id_ou_numero }) => {
      if (!(await requireSubscription(db, userId))) return fail(NO_SUBSCRIPTION)
      const { data: devis, error } = await trouverDocument(db, userId, 'devis', id_ou_numero, 'id')
      if (error) return fail(error.message)
      if (!devis) return fail('Devis introuvable.')
      const res = await convertirDevisEnFacture(db, userId, devis.id)
      return res.ok ? json({ cree: true, facture: res.facture, avertissement: res.avertissement }) : fail(res.erreur)
    },
  )

  // ── Paiement d'une facture ─────────────────────────────────
  server.registerTool(
    'marquer_facture_payee',
    {
      title: 'Marquer une facture comme payée',
      description:
        "Enregistre le paiement d'une facture « en attente » ou « en retard » (date et moyen de paiement). La date par défaut est aujourd'hui. Ne modifie rien d'autre sur la facture.",
      inputSchema: {
        id_ou_numero: z.string().min(1).max(64),
        moyen_paiement: z.enum(MOYENS),
        date_paiement: dateSchema.optional(),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ id_ou_numero, moyen_paiement, date_paiement }) => {
      if (!(await requireSubscription(db, userId))) return fail(NO_SUBSCRIPTION)
      const { data: f, error } = await trouverDocument(db, userId, 'factures', id_ou_numero, 'id, numero, statut, montant_total')
      if (error) return fail(error.message)
      if (!f) return fail('Facture introuvable.')
      if (!['en_attente', 'retard'].includes(f.statut)) return fail(`La facture ${f.numero} est « ${f.statut} » : elle ne peut pas être marquée payée.`)
      if (Number(f.montant_total) <= 0) return fail(`La facture ${f.numero} n'a pas de montant positif à encaisser.`)
      const date = date_paiement ?? aujourdhui()
      const { error: uErr } = await db
        .from('factures')
        .update({ statut: 'payee', date_paiement: date, moyen_paiement })
        .eq('id', f.id)
        .eq('user_id', userId)
      return uErr ? fail(uErr.message) : json({ modifie: true, facture: f.numero, statut: 'payee', date_paiement: date, moyen_paiement })
    },
  )

  // ── Acompte ────────────────────────────────────────────────
  server.registerTool(
    'creer_facture_acompte',
    {
      title: "Créer une facture d'acompte",
      description:
        "Crée une facture d'acompte pour un devis « accepté » ou « signé », soit en pourcentage du total (ex. 50), soit pour un montant fixe. Indiquer l'un OU l'autre. Les acomptes cumulés ne peuvent pas dépasser le total du devis. La facture d'acompte n'est PAS rattachée au devis (le devis reste convertible) : la facture finale devra tenir compte des acomptes déjà facturés.",
      inputSchema: {
        id_ou_numero: z.string().min(1).max(64),
        pourcentage: z.number().gt(0).lt(100).optional(),
        montant: z.number().gt(0).max(1000000).optional(),
        date_echeance: dateSchema.optional(),
      },
      annotations: WRITE,
    },
    async ({ id_ou_numero, pourcentage, montant, date_echeance }) => {
      if ((pourcentage === undefined) === (montant === undefined)) return fail("Indiquer soit 'pourcentage', soit 'montant' (un seul des deux).")
      if (!(await requireSubscription(db, userId))) return fail(NO_SUBSCRIPTION)

      const { data: devis, error } = await trouverDocument(db, userId, 'devis', id_ou_numero, 'id, numero, titre, statut, client_id, montant_total')
      if (error) return fail(error.message)
      if (!devis) return fail('Devis introuvable.')
      if (!['accepte', 'signe'].includes(devis.statut)) {
        return fail(`Le devis ${devis.numero} est « ${devis.statut} » : un acompte n'est possible que sur un devis accepté ou signé.`)
      }
      const totalDevis = Number(devis.montant_total)
      if (totalDevis <= 0) return fail(`Le devis ${devis.numero} n'a pas de montant.`)

      const montantAcompte = arrondi2(pourcentage !== undefined ? (totalDevis * pourcentage) / 100 : (montant as number))
      const reference = `Acompte sur devis ${devis.numero}`
      const { data: precedents, error: pErr } = await db
        .from('factures')
        .select('montant_total')
        .eq('user_id', userId)
        .like('notes_client', `${reference}%`)
        .neq('statut', 'annulee')
      if (pErr) return fail(pErr.message)
      const dejaFacture = arrondi2((precedents ?? []).reduce((s, f) => s + Number(f.montant_total), 0))
      if (dejaFacture + montantAcompte > totalDevis + 0.001) {
        return fail(`Acomptes cumulés (${dejaFacture} € déjà facturés + ${montantAcompte} €) supérieurs au total du devis (${totalDevis} €).`)
      }

      const { data: numero, error: nErr } = await db.rpc('mcp_next_numero', { p_user_id: userId, p_type: 'facture' })
      if (nErr) return fail(nErr.message)

      const libelle = pourcentage !== undefined ? `Acompte ${pourcentage} % — devis ${devis.numero}` : `Acompte — devis ${devis.numero}`
      const { data: facture, error: fErr } = await db
        .from('factures')
        .insert({
          user_id: userId,
          client_id: devis.client_id,
          devis_id: null,
          numero: numero as string,
          titre: devis.titre ? `Acompte — ${devis.titre}` : libelle,
          date_echeance: date_echeance ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          notes_client: reference,
          statut: 'en_attente',
          montant_ht: montantAcompte,
          montant_total: montantAcompte,
          ...(await noteGoogle(db, userId)),
        })
        .select('id, numero')
        .single()
      if (fErr) return fail(fErr.message)

      const { error: lErr } = await insertLignes(db, userId, 'facture', facture.id, [
        { description: libelle, detail: devis.titre ?? undefined, quantite: 1, unite: 'forfait', prix_unitaire: montantAcompte },
      ])
      if (lErr) {
        await db.from('factures').delete().eq('id', facture.id).eq('user_id', userId)
        return fail(lErr.message)
      }
      return json({
        cree: true,
        facture: facture.numero,
        montant_acompte: montantAcompte,
        total_devis: totalDevis,
        total_acomptes_factures: arrondi2(dejaFacture + montantAcompte),
        reste_a_facturer: arrondi2(totalDevis - dejaFacture - montantAcompte),
      })
    },
  )

  // ── Signature électronique ─────────────────────────────────
  server.registerTool(
    'lien_signature_devis',
    {
      title: "Lien de signature électronique d'un devis",
      description:
        "Renvoie le lien public de signature électronique d'un devis « en attente », à envoyer au client. Si la signature n'est pas encore activée sur ce devis, passer activer=true pour l'activer. Le lien est secret : ne le donner qu'au client concerné.",
      inputSchema: { id_ou_numero: z.string().min(1).max(64), activer: z.boolean().default(false) },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ id_ou_numero, activer }) => {
      const { data: d, error } = await trouverDocument(db, userId, 'devis', id_ou_numero, 'id, numero, statut, signature_activee, signature_token')
      if (error) return fail(error.message)
      if (!d) return fail('Devis introuvable.')
      if (d.statut !== 'en_attente') return fail(`Le devis ${d.numero} est « ${d.statut} » : il ne peut plus être signé.`)
      if (!d.signature_token) return fail('Ce devis n\'a pas de jeton de signature.')
      if (!d.signature_activee) {
        if (!activer) return fail(`La signature électronique n'est pas activée sur ${d.numero}. Rappeler avec activer=true pour l'activer.`)
        if (!(await requireSubscription(db, userId))) return fail(NO_SUBSCRIPTION)
        const { error: uErr } = await db.from('devis').update({ signature_activee: true }).eq('id', d.id).eq('user_id', userId)
        if (uErr) return fail(uErr.message)
      }
      return json({ devis: d.numero, signature_activee: true, lien_signature: `${origin}/devis/signature/${d.signature_token}` })
    },
  )

  // ── Envoi par e-mail (Resend) ──────────────────────────────
  server.registerTool(
    'envoyer_document_par_email',
    {
      title: 'Envoyer un devis ou une facture par e-mail',
      description:
        "Envoie le PDF d'un devis ou d'une facture à l'adresse e-mail ENREGISTRÉE du client (impossible d'envoyer ailleurs). Nécessite la confirmation explicite de l'utilisateur (confirmer=true) : l'envoi est irréversible. Le service d'envoi doit être configuré sur le serveur (RESEND_API_KEY, EMAIL_FROM).",
      inputSchema: {
        type: z.enum(['devis', 'facture']),
        id_ou_numero: z.string().min(1).max(64),
        message: z.string().max(2000).optional(),
        confirmer: z.literal(true).describe("Doit valoir true : l'utilisateur a explicitement validé l'envoi à ce client."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ type, id_ou_numero, message }) => {
      const cle = process.env.RESEND_API_KEY ?? ''
      const expediteur = process.env.EMAIL_FROM ?? ''
      if (!cle || !expediteur) {
        return fail("L'envoi d'e-mails n'est pas configuré sur le serveur (variables RESEND_API_KEY et EMAIL_FROM). Utiliser telecharger_pdf_* puis envoyer le fichier autrement.")
      }
      const table = type === 'devis' ? 'devis' : 'factures'
      const { data: doc, error } = await trouverDocument(db, userId, table, id_ou_numero, 'id, numero, client_id, statut')
      if (error) return fail(error.message)
      if (!doc) return fail('Document introuvable.')
      if (type === 'facture' && doc.statut === 'annulee') return fail(`La facture ${doc.numero} est annulée.`)

      const { data: client } = await db.from('clients').select('nom, email').eq('id', doc.client_id).eq('user_id', userId).maybeSingle()
      if (!client?.email) return fail("Ce client n'a pas d'adresse e-mail enregistrée (utiliser modifier_client).")
      const { data: params } = await db.from('parametres_compte').select('nom_entreprise, email_entreprise').eq('user_id', userId).maybeSingle()

      const pdf = await genererPdfDocument(db, userId, type, doc.id)
      if (!pdf.ok) return fail(pdf.erreur)

      const entreprise = String(params?.nom_entreprise ?? 'Mon entreprise')
      const nomAffiche = entreprise.replace(/[<>",]/g, '').trim() || 'Mon entreprise'
      const libelle = type === 'devis' ? 'devis' : 'facture'
      const corps =
        message?.trim() ||
        `Bonjour ${client.nom},\n\nVeuillez trouver ci-joint votre ${libelle} ${doc.numero}.\n\nCordialement,\n${nomAffiche}`
      const reponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${cle}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: `${nomAffiche} <${expediteur}>`,
          to: [client.email],
          reply_to: params?.email_entreprise || undefined,
          subject: `${libelle[0].toUpperCase()}${libelle.slice(1)} ${doc.numero} — ${nomAffiche}`,
          text: corps,
          attachments: [{ filename: pdf.filename, content: Buffer.from(pdf.bytes).toString('base64') }],
        }),
        signal: AbortSignal.timeout(20000),
      }).catch((e: Error) => e)
      if (reponse instanceof Error) return fail(`Envoi impossible : ${reponse.message}`)
      if (!reponse.ok) return fail(`Le service d'envoi a refusé le message (${reponse.status}) : ${(await reponse.text()).slice(0, 300)}`)
      return json({ envoye: true, document: doc.numero, destinataire: client.email })
    },
  )

  // ── Relances ───────────────────────────────────────────────
  server.registerTool(
    'lister_clients_a_relancer',
    {
      title: 'Clients à relancer',
      description:
        "Liste les clients sans activité (aucun devis, facture ni contact) depuis N mois, du plus ancien au plus récent. Par défaut N = délai configuré dans Paramètres (6 mois sinon).",
      inputSchema: { mois: z.number().int().min(1).max(60).optional(), limite: limitSchema },
      annotations: READ_ONLY,
    },
    async ({ mois, limite }) => {
      let delai = mois
      if (!delai) {
        const { data } = await db.from('configuration_relances').select('mois_sans_activite').eq('user_id', userId).maybeSingle()
        delai = data?.mois_sans_activite ?? 6
      }
      const seuil = new Date()
      seuil.setUTCMonth(seuil.getUTCMonth() - (delai as number))

      const [clients, devis, factures, relances] = await Promise.all([
        db.from('clients').select('id, nom, nom_entreprise, email, telephone, date_creation, dernier_contact').eq('user_id', userId).limit(2000),
        db.from('devis').select('client_id, date_creation').eq('user_id', userId).order('date_creation', { ascending: false }).limit(5000),
        db.from('factures').select('client_id, date_creation').eq('user_id', userId).order('date_creation', { ascending: false }).limit(5000),
        db.from('relances_historique').select('client_id, date_relance').eq('user_id', userId).order('date_relance', { ascending: false }).limit(5000),
      ])
      if (clients.error) return fail(clients.error.message)

      const plusRecent = new Map<string, string>()
      const noter = (id: string, date: string | null) => {
        if (date && (!plusRecent.get(id) || date > (plusRecent.get(id) as string))) plusRecent.set(id, date)
      }
      for (const c of clients.data ?? []) { noter(c.id, c.date_creation); noter(c.id, c.dernier_contact) }
      for (const r of [...(devis.data ?? []), ...(factures.data ?? [])]) noter(r.client_id, r.date_creation)
      const derniereRelance = new Map<string, string>()
      for (const r of relances.data ?? []) if (!derniereRelance.has(r.client_id)) derniereRelance.set(r.client_id, r.date_relance)

      const liste = (clients.data ?? [])
        .map((c) => ({ c, activite: plusRecent.get(c.id) as string }))
        .filter(({ activite }) => new Date(activite) < seuil)
        .sort((a, b) => a.activite.localeCompare(b.activite))
        .slice(0, limite)
        .map(({ c, activite }) => ({
          client_id: c.id,
          nom: c.nom,
          entreprise: c.nom_entreprise,
          email: c.email,
          telephone: c.telephone,
          derniere_activite: activite.slice(0, 10),
          jours_sans_activite: Math.floor((Date.now() - new Date(activite).getTime()) / 86400000),
          derniere_relance: derniereRelance.get(c.id)?.slice(0, 10) ?? null,
        }))
      return json({ delai_mois: delai, nombre: liste.length, clients: liste })
    },
  )

  server.registerTool(
    'lister_factures_a_relancer',
    {
      title: 'Factures impayées à relancer',
      description: "Liste les factures « en attente » ou « en retard » dont l'échéance est dépassée, avec le nombre de jours de retard et les coordonnées du client.",
      inputSchema: { limite: limitSchema },
      annotations: READ_ONLY,
    },
    async ({ limite }) => {
      const { data, error } = await db
        .from('factures')
        .select('id, numero, statut, montant_total, date_echeance, clients(nom, nom_entreprise, email, telephone)')
        .eq('user_id', userId)
        .in('statut', ['en_attente', 'retard'])
        .lt('date_echeance', aujourdhui())
        .gt('montant_total', 0)
        .order('date_echeance', { ascending: true })
        .limit(limite)
      if (error) return fail(error.message)
      const factures = (data ?? []).map((f: any) => ({
        ...f,
        jours_de_retard: Math.floor((Date.now() - new Date(f.date_echeance).getTime()) / 86400000),
      }))
      return json({
        nombre: factures.length,
        total_en_retard: arrondi2(factures.reduce((s: number, f: any) => s + Number(f.montant_total), 0)),
        factures,
      })
    },
  )

  server.registerTool(
    'enregistrer_relance',
    {
      title: 'Enregistrer une relance faite à un client',
      description:
        "Note dans l'historique qu'une relance a été faite à un client (date, canal, message) et met à jour sa date de dernier contact. N'ENVOIE rien : pour envoyer un e-mail, utiliser envoyer_document_par_email.",
      inputSchema: {
        client_id: z.string().uuid(),
        message: z.string().min(1).max(2000),
        canal: z.enum(['email', 'sms', 'notification']).default('email'),
      },
      annotations: WRITE,
    },
    async ({ client_id, message, canal }) => {
      const { data: client } = await db.from('clients').select('id, nom').eq('id', client_id).eq('user_id', userId).maybeSingle()
      if (!client) return fail('Client introuvable.')
      const { error } = await db.from('relances_historique').insert({ user_id: userId, client_id, message, type_relance: canal })
      if (error) return fail(error.message)
      await db.from('clients').update({ dernier_contact: new Date().toISOString() }).eq('id', client_id).eq('user_id', userId)
      return json({ enregistre: true, client: client.nom, canal })
    },
  )

  // ── Recherche transversale ─────────────────────────────────
  server.registerTool(
    'rechercher_documents',
    {
      title: 'Rechercher des devis et factures',
      description:
        "Recherche des devis et/ou factures par client (nom, entreprise ou email), statut, plage de montants et plage de dates de création. Tous les filtres sont optionnels et se cumulent.",
      inputSchema: {
        type: z.enum(['devis', 'facture', 'tous']).default('tous'),
        client: z.string().max(100).optional(),
        statut: z.string().max(20).optional(),
        montant_min: z.number().optional(),
        montant_max: z.number().optional(),
        date_debut: dateSchema.optional(),
        date_fin: dateSchema.optional(),
        limite: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async ({ type, client, statut, montant_min, montant_max, date_debut, date_fin, limite }) => {
      let clientIds: string[] | null = null
      const s = client ? cleanSearch(client) : ''
      if (s) {
        const { data, error } = await db
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .or(`nom.ilike.%${s}%,nom_entreprise.ilike.%${s}%,email.ilike.%${s}%`)
          .limit(200)
        if (error) return fail(error.message)
        clientIds = (data ?? []).map((c) => c.id)
        if (!clientIds.length) return json({ nombre: 0, documents: [] })
      }

      const chercher = async (table: 'devis' | 'factures') => {
        let q = db
          .from(table)
          .select('id, numero, titre, statut, montant_total, date_creation, clients(nom, nom_entreprise)')
          .eq('user_id', userId)
          .order('date_creation', { ascending: false })
          .limit(limite)
        if (clientIds) q = q.in('client_id', clientIds)
        if (statut) q = q.eq('statut', statut)
        if (montant_min !== undefined) q = q.gte('montant_total', montant_min)
        if (montant_max !== undefined) q = q.lte('montant_total', montant_max)
        if (date_debut) q = q.gte('date_creation', `${date_debut}T00:00:00Z`)
        if (date_fin) q = q.lte('date_creation', `${date_fin}T23:59:59Z`)
        const { data, error } = await q
        if (error) throw new Error(error.message)
        return (data ?? []).map((d: any) => ({ type: table === 'devis' ? 'devis' : 'facture', ...d }))
      }
      try {
        const [d, f] = await Promise.all([type !== 'facture' ? chercher('devis') : [], type !== 'devis' ? chercher('factures') : []])
        const documents = [...d, ...f].sort((a: any, b: any) => String(b.date_creation).localeCompare(String(a.date_creation))).slice(0, limite)
        return json({ nombre: documents.length, documents })
      } catch (e) {
        return fail((e as Error).message)
      }
    },
  )

  // ── Statistiques et rapports ───────────────────────────────
  server.registerTool(
    'statistiques',
    {
      title: 'Statistiques du tableau de bord',
      description: "CA du mois et de l'année, CA à venir, taux d'acceptation des devis, devis en attente, factures en retard, nombre de clients.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        return json(await calculerStatistiques(db, userId))
      } catch (e) {
        return fail((e as Error).message)
      }
    },
  )

  server.registerTool(
    'rapport_activite',
    {
      title: "Rapport d'activité annuel",
      description:
        "Chiffre d'affaires encaissé mois par mois pour une année, top des clients par CA encaissé, nombre de devis et factures par statut. Année par défaut : l'année en cours.",
      inputSchema: { annee: z.number().int().min(2000).max(2100).optional() },
      annotations: READ_ONLY,
    },
    async ({ annee }) => {
      const an = annee ?? new Date().getUTCFullYear()
      const [payees, devis, factures] = await Promise.all([
        db
          .from('factures')
          .select('montant_total, date_paiement, client_id, clients(nom, nom_entreprise)')
          .eq('user_id', userId)
          .eq('statut', 'payee')
          .gte('date_paiement', `${an}-01-01`)
          .lt('date_paiement', `${an + 1}-01-01`)
          .limit(10000),
        db.from('devis').select('statut').eq('user_id', userId).gte('date_creation', `${an}-01-01`).lt('date_creation', `${an + 1}-01-01`).limit(10000),
        db.from('factures').select('statut').eq('user_id', userId).gte('date_creation', `${an}-01-01`).lt('date_creation', `${an + 1}-01-01`).limit(10000),
      ])
      for (const r of [payees, devis, factures]) if (r.error) return fail(r.error.message)

      const parMois = Array.from({ length: 12 }, (_, i) => ({ mois: `${an}-${String(i + 1).padStart(2, '0')}`, ca_encaisse: 0 }))
      const parClient = new Map<string, { nom: string; ca: number }>()
      for (const f of (payees.data ?? []) as any[]) {
        const m = Number(String(f.date_paiement).slice(5, 7)) - 1
        if (m >= 0 && m < 12) parMois[m].ca_encaisse = arrondi2(parMois[m].ca_encaisse + Number(f.montant_total))
        const nom = f.clients?.nom_entreprise || f.clients?.nom || 'Client inconnu'
        const cur = parClient.get(f.client_id) ?? { nom, ca: 0 }
        cur.ca = arrondi2(cur.ca + Number(f.montant_total))
        parClient.set(f.client_id, cur)
      }
      const compter = (rows: { statut: string }[] | null) =>
        (rows ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.statut]: (acc[r.statut] ?? 0) + 1 }), {})
      return json({
        annee: an,
        ca_total_encaisse: arrondi2(parMois.reduce((s, m) => s + m.ca_encaisse, 0)),
        ca_par_mois: parMois,
        top_clients: [...parClient.values()].sort((a, b) => b.ca - a.ca).slice(0, 10),
        devis_par_statut: compter(devis.data),
        factures_par_statut: compter(factures.data),
      })
    },
  )

  // ── Journal d'activité ─────────────────────────────────────
  server.registerTool(
    'journal_activite',
    {
      title: "Journal d'activité de l'IA",
      description: "Liste les dernières actions d'écriture faites via le MCP sur ce compte (création, modification, envoi…), les plus récentes d'abord.",
      inputSchema: { limite: z.number().int().min(1).max(100).default(30) },
      annotations: READ_ONLY,
    },
    async ({ limite }) => {
      const { data, error } = await db
        .from('mcp_journal')
        .select('created_at, outil, resume')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limite)
      if (error) return fail("Journal indisponible (migration 006_mcp_options.sql non exécutée ?) : " + error.message)
      return json({ nombre: data?.length ?? 0, actions: data })
    },
  )
}

