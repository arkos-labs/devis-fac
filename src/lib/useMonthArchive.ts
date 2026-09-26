// ============================================================
// HOOK — export ZIP de tous les devis/factures d'un mois donné
// ============================================================
import { useState } from 'react'
import JSZip from 'jszip'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Devis, Facture, Client, ParametresCompte, LignePrestation } from '@/types/database'
import { generateDownloadableDocument, downloadBlob } from '@/lib/facturx'
import toast from 'react-hot-toast'

export function useMonthArchive() {
  const { user } = useAuth()
  const [isExporting, setIsExporting] = useState(false)

  /**
   * @param items Tous les documents déjà chargés (dans lesquels on filtre le mois)
   * @param month Format "YYYY-MM"
   */
  const exportMonth = async (items: (Devis | Facture)[], type: 'devis' | 'facture', month: string) => {
    if (!user) return
    const filtered = items.filter(d => d.date_creation.startsWith(month))
    if (filtered.length === 0) {
      toast.error('Aucun document pour ce mois')
      return
    }

    setIsExporting(true)
    try {
      const { data: parametres, error: errParams } = await supabase
        .from('parametres_compte').select('*').eq('user_id', user.id).single()
      if (errParams) throw errParams
      if (!parametres) throw new Error('Paramètres du compte manquants')

      const zip = new JSZip()
      const usedNames = new Set<string>()

      for (const document of filtered) {
        const [{ data: lignes, error: errLignes }, clientResult] = await Promise.all([
          supabase.from('lignes_prestation').select('*').eq('document_type', type).eq('document_id', document.id).order('ordre'),
          document.clients
            ? Promise.resolve({ data: document.clients, error: null })
            : supabase.from('clients').select('*').eq('id', document.client_id).single(),
        ])
        if (errLignes) throw errLignes
        if (clientResult.error) throw clientResult.error
        if (!clientResult.data) continue

        const { blob, filename } = await generateDownloadableDocument({
          document,
          type,
          lignes: (lignes ?? []) as LignePrestation[],
          client: clientResult.data as Client,
          parametres: parametres as ParametresCompte,
        })

        let name = filename
        let i = 2
        while (usedNames.has(name)) { name = filename.replace('.pdf', `-${i}.pdf`); i++ }
        usedNames.add(name)
        zip.file(name, blob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const label = type === 'devis' ? 'Devis' : 'Factures'
      downloadBlob(zipBlob, `${label}_${month}.zip`)
      toast.success(`${filtered.length} document${filtered.length > 1 ? 's' : ''} exporté${filtered.length > 1 ? 's' : ''} !`)
    } catch (e) {
      toast.error(`Erreur export : ${(e as Error).message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return { exportMonth, isExporting }
}
