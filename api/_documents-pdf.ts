// Génération du PDF d'un devis ou d'une facture côté serveur, avec les mêmes générateurs que le site :
// - devis   → PDF simple (src/lib/pdf-generator.ts)
// - facture → Factur-X (PDF + XML CII embarqué), comme le bouton « Télécharger » du site
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateDownloadableDocument } from '../src/lib/facturx.js'
import type { Client, Devis, Facture, LignePrestation, ParametresCompte } from '../src/types/database'

export type TypeDocument = 'devis' | 'facture'

export type ResultatPdf =
  | { ok: true; bytes: Uint8Array; filename: string; numero: string; facturX: boolean }
  | { ok: false; erreur: string }

export async function genererPdfDocument(
  db: SupabaseClient,
  userId: string,
  type: TypeDocument,
  docId: string,
): Promise<ResultatPdf> {
  const table = type === 'devis' ? 'devis' : 'factures'
  const { data: doc, error } = await db.from(table).select('*').eq('id', docId).eq('user_id', userId).maybeSingle()
  if (error) return { ok: false, erreur: error.message }
  if (!doc) return { ok: false, erreur: type === 'devis' ? 'Devis introuvable.' : 'Facture introuvable.' }

  const [client, parametres, lignes] = await Promise.all([
    db.from('clients').select('*').eq('id', doc.client_id).eq('user_id', userId).maybeSingle(),
    db.from('parametres_compte').select('*').eq('user_id', userId).maybeSingle(),
    db
      .from('lignes_prestation')
      .select('*')
      .eq('user_id', userId)
      .eq('document_type', type)
      .eq('document_id', docId)
      .order('ordre'),
  ])
  if (client.error || !client.data) return { ok: false, erreur: 'Client du document introuvable.' }
  if (parametres.error || !parametres.data) return { ok: false, erreur: 'Paramètres du compte introuvables.' }
  if (lignes.error) return { ok: false, erreur: lignes.error.message }
  // Mêmes contrôles que l'application avant de générer un document
  if (!(parametres.data as ParametresCompte).siret) return { ok: false, erreur: 'SIRET manquant (Paramètres).' }
  if (type === 'facture' && !(doc as Facture).date_echeance) return { ok: false, erreur: "Date d'échéance manquante sur la facture." }

  const res = await generateDownloadableDocument({
    document: doc as Devis | Facture,
    type,
    lignes: (lignes.data ?? []) as LignePrestation[],
    client: client.data as Client,
    parametres: parametres.data as ParametresCompte,
  })
  const bytes = new Uint8Array(await res.blob.arrayBuffer())
  return { ok: true, bytes, filename: res.filename, numero: doc.numero as string, facturX: res.isFacturX }
}
