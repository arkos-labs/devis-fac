// ============================================================
// HOOK — téléchargement direct d'un devis/facture depuis une liste
// (sans passer par l'aperçu). Charge les données manquantes puis
// génère le PDF (ou Factur-X pour une facture) et le télécharge.
// ============================================================
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Devis, Facture, Client, ParametresCompte, LignePrestation } from '@/types/database'
import { generateDownloadableDocument, downloadBlob } from '@/lib/facturx'
import toast from 'react-hot-toast'

export function useDocumentDownload() {
  const { user } = useAuth()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const download = async (document: Devis | Facture, type: 'devis' | 'facture') => {
    if (!user) return
    setDownloadingId(document.id)
    try {
      const [{ data: parametres, error: errParams }, { data: lignes, error: errLignes }, { data: client, error: errClient }] = await Promise.all([
        supabase.from('parametres_compte').select('*').eq('user_id', user.id).single(),
        supabase.from('lignes_prestation').select('*').eq('document_type', type).eq('document_id', document.id).order('ordre'),
        document.clients
          ? Promise.resolve({ data: document.clients, error: null })
          : supabase.from('clients').select('*').eq('id', document.client_id).single(),
      ])
      if (errParams) throw errParams
      if (errLignes) throw errLignes
      if (errClient) throw errClient
      if (!parametres) throw new Error('Paramètres du compte manquants')
      if (!client) throw new Error('Client introuvable')

      const { blob, filename, isFacturX } = await generateDownloadableDocument({
        document,
        type,
        lignes: (lignes ?? []) as LignePrestation[],
        client: client as Client,
        parametres: parametres as ParametresCompte,
      })
      downloadBlob(blob, filename)
      toast.success(isFacturX ? 'Facture Factur-X téléchargée !' : 'Devis téléchargé !')
    } catch (e) {
      toast.error(`Erreur génération : ${(e as Error).message}`)
    } finally {
      setDownloadingId(null)
    }
  }

  return { download, downloadingId }
}
