// ============================================================
// HOOK — téléchargement direct d'un devis/facture depuis une liste
// (sans passer par l'aperçu). Charge les données manquantes puis
// génère le PDF (ou Factur-X pour une facture) et le télécharge.
// ============================================================
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatEuros } from '@/lib/utils'
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

  // Télécharge le PDF/Factur-X puis ouvre un brouillon email — un lien
  // mailto: ne peut pas joindre de fichier automatiquement (limitation des
  // navigateurs), le fichier téléchargé doit être glissé dans l'email par
  // l'utilisateur.
  const sendByEmail = async (document: Devis | Facture, type: 'devis' | 'facture', clientEmail: string) => {
    if (!clientEmail) return toast.error("Ce client n'a pas d'email renseigné")
    await download(document, type)

    const titre = document.titre || 'prestation'
    const total = formatEuros(document.montant_total)
    if (type === 'devis') {
      const d = document as Devis
      const valDate = d.date_validite ? new Date(d.date_validite).toLocaleDateString('fr-FR') : '—'
      const subject = encodeURIComponent(`Devis — ${titre}`)
      const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint votre devis pour : ${titre}.\n\nMontant total : ${total}\nValidité : jusqu'au ${valDate}\n\n(Le fichier téléchargé est à joindre à cet email)\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement`)
      window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`)
    } else {
      const f = document as Facture
      const echDate = f.date_echeance ? new Date(f.date_echeance).toLocaleDateString('fr-FR') : '—'
      const subject = encodeURIComponent(`Facture — ${titre}`)
      const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint votre facture pour : ${titre}.\n\nMontant total : ${total}\nÉchéance : ${echDate}\n\n(Le fichier téléchargé est à joindre à cet email)\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement`)
      window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`)
    }
  }

  return { download, downloadingId, sendByEmail }
}
