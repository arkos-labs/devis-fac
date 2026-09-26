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

  const generate = async (document: Devis | Facture, type: 'devis' | 'facture') => {
    if (!user) throw new Error('Non authentifié')
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

    return generateDownloadableDocument({
      document,
      type,
      lignes: (lignes ?? []) as LignePrestation[],
      client: client as Client,
      parametres: parametres as ParametresCompte,
    })
  }

  const download = async (document: Devis | Facture, type: 'devis' | 'facture') => {
    setDownloadingId(document.id)
    try {
      const { blob, filename, isFacturX } = await generate(document, type)
      downloadBlob(blob, filename)
      toast.success(isFacturX ? 'Facture Factur-X téléchargée !' : 'Devis téléchargé !')
    } catch (e) {
      toast.error(`Erreur génération : ${(e as Error).message}`)
    } finally {
      setDownloadingId(null)
    }
  }

  const buildEmailText = (document: Devis | Facture, type: 'devis' | 'facture') => {
    const titre = document.titre || 'prestation'
    const total = formatEuros(document.montant_total)
    if (type === 'devis') {
      const d = document as Devis
      const valDate = d.date_validite ? new Date(d.date_validite).toLocaleDateString('fr-FR') : '—'
      const signatureLine = d.signature_activee && d.signature_token
        ? `\n\nPour valider ce devis, signez-le en ligne ici :\n${window.location.origin}/devis/signature/${d.signature_token}\n`
        : ''
      return {
        subject: `Devis — ${titre}`,
        body: `Bonjour,\n\nVeuillez trouver ci-joint votre devis pour : ${titre}.\n\nMontant total : ${total}\nValidité : jusqu'au ${valDate}${signatureLine}\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement`,
      }
    }
    const f = document as Facture
    const echDate = f.date_echeance ? new Date(f.date_echeance).toLocaleDateString('fr-FR') : '—'
    return {
      subject: `Facture — ${titre}`,
      body: `Bonjour,\n\nVeuillez trouver ci-joint votre facture pour : ${titre}.\n\nMontant total : ${total}\nÉchéance : ${echDate}\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement`,
    }
  }

  // Joint automatiquement le PDF/Factur-X à l'email via l'API de partage native
  // du navigateur (ouvre le sélecteur d'apps du système avec le fichier déjà
  // en pièce jointe — fonctionne avec l'app Mail/Outlook/Gmail sur Chrome,
  // Edge et Safari). Un lien mailto: classique ne peut pas joindre de fichier
  // (limitation navigateur) : on l'utilise seulement en repli si le partage
  // natif n'est pas disponible, avec téléchargement du fichier à joindre soi-même.
  const sendByEmail = async (document: Devis | Facture, type: 'devis' | 'facture', clientEmail: string) => {
    if (!clientEmail) return toast.error("Ce client n'a pas d'email renseigné")
    setDownloadingId(document.id)
    try {
      const { blob, filename } = await generate(document, type)
      const { subject, body } = buildEmailText(document, type)
      const file = new File([blob], filename, { type: blob.type })

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        // Le partage natif n'a pas de champ "destinataire" (limitation de
        // l'API) — on copie l'adresse dans le presse-papier et on prévient
        // AVANT d'ouvrir le sélecteur d'app, pour que le message soit vu
        // avant que l'appli mail ne prenne l'écran.
        let copied = false
        try { await navigator.clipboard.writeText(clientEmail); copied = true } catch { /* presse-papier indisponible */ }
        if (copied) {
          toast.success(`Adresse copiée : collez-la (Ctrl+V) dans le champ "À" de l'email — ${clientEmail}`, { duration: 8000 })
        }
        await navigator.share({ files: [file], title: subject, text: body })
        return
      }

      downloadBlob(blob, filename)
      window.open(`mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n(Le fichier téléchargé est à joindre à cet email)`)}`)
      toast('Partage automatique indisponible sur ce navigateur : le fichier a été téléchargé, joins-le manuellement.', { icon: '📎' })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast.error(`Erreur d'envoi : ${(e as Error).message}`)
      }
    } finally {
      setDownloadingId(null)
    }
  }

  return { download, downloadingId, sendByEmail }
}
