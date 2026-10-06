// Génération du PDF d'un devis côté serveur, avec le même générateur que le site
// (src/lib/pdf-generator.ts) : le fichier est identique à celui du bouton « Télécharger ».
// Le préfixe « _ » empêche Vercel d'exposer ce fichier comme une route.
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateDocumentPdf } from '../src/lib/pdf-generator'
import type { Client, Devis, LignePrestation, ParametresCompte } from '../src/types/database'

export type ResultatPdf =
  | { ok: true; bytes: Uint8Array; filename: string; numero: string }
  | { ok: false; erreur: string }

export async function genererPdfDevis(db: SupabaseClient, userId: string, devisId: string): Promise<ResultatPdf> {
  const { data: devis, error } = await db
    .from('devis')
    .select('*')
    .eq('id', devisId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { ok: false, erreur: error.message }
  if (!devis) return { ok: false, erreur: 'Devis introuvable.' }

  const [client, parametres, lignes] = await Promise.all([
    db.from('clients').select('*').eq('id', devis.client_id).eq('user_id', userId).maybeSingle(),
    db.from('parametres_compte').select('*').eq('user_id', userId).maybeSingle(),
    db
      .from('lignes_prestation')
      .select('*')
      .eq('user_id', userId)
      .eq('document_type', 'devis')
      .eq('document_id', devisId)
      .order('ordre'),
  ])
  if (client.error || !client.data) return { ok: false, erreur: 'Client du devis introuvable.' }
  if (parametres.error || !parametres.data) return { ok: false, erreur: 'Paramètres du compte introuvables.' }
  if (lignes.error) return { ok: false, erreur: lignes.error.message }
  // Même contrôle que l'application avant de générer un document
  if (!(parametres.data as ParametresCompte).siret) return { ok: false, erreur: 'SIRET manquant (Paramètres).' }

  const bytes = await generateDocumentPdf({
    document: devis as Devis,
    type: 'devis',
    lignes: (lignes.data ?? []) as LignePrestation[],
    client: client.data as Client,
    parametres: parametres.data as ParametresCompte,
  })
  return { ok: true, bytes, filename: `${devis.numero}.pdf`, numero: devis.numero as string }
}
