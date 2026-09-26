import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, ZoomIn, ZoomOut, Download, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import DocumentPDF from './DocumentPDF'
import type { Devis, Facture, LignePrestation, ParametresCompte, Client } from '@/types/database'
import { generateDownloadableDocument, downloadBlob } from '@/lib/facturx'
import toast from 'react-hot-toast'
import '@/components/pdf/print.css'

type Document = Devis | Facture

interface PrintModalProps {
  document: Document
  type: 'devis' | 'facture'
  onClose: () => void
}

export default function PrintModal({ document, type, onClose }: PrintModalProps) {
  const { user } = useAuth()
  const [zoom, setZoom] = useState(0.75)
  const [isDownloading, setIsDownloading] = useState(false)
  const printRootRef = useRef<HTMLDivElement | null>(null)

  // ── Charger les paramètres ───────────────────────────────
  const { data: parametres, isLoading: paramsLoading } = useQuery<ParametresCompte>({
    queryKey: ['parametres', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parametres_compte').select('*').eq('user_id', user!.id).single()
      if (error) throw error
      return data as ParametresCompte
    },
    enabled: !!user,
  })

  // ── Charger les lignes ───────────────────────────────────
  const { data: lignes = [], isLoading: lignesLoading } = useQuery<LignePrestation[]>({
    queryKey: ['lignes', type, document.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lignes_prestation')
        .select('*')
        .eq('document_type', type)
        .eq('document_id', document.id)
        .order('ordre')
      if (error) throw error
      return (data ?? []) as LignePrestation[]
    },
  })

  const { data: clientData, isLoading: clientLoading } = useQuery({
    queryKey: ['client-detail', document.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients').select('*').eq('id', document.client_id).single()
      if (error) throw error
      return data
    },
    enabled: !document.clients,
  })

  const docWithClient = {
    ...document,
    clients: document.clients ?? clientData,
  }

  // ── Fermer avec Escape ───────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Validation mentions obligatoires ────────────────────
  const validationErrors: string[] = []
  if (type === 'facture') {
    const f = document as Facture
    if (!f.date_echeance) validationErrors.push('Date d\'échéance manquante')
  }
  if (parametres && !parametres.siret) validationErrors.push('SIRET manquant (Paramètres)')

  // ── Impression ───────────────────────────────────────────
  const handlePrint = () => {
    if (!parametres || isLoading) return
    if (validationErrors.length > 0) {
      alert(`Impossible de générer le PDF :\n\n${validationErrors.map(e => `• ${e}`).join('\n')}`)
      return
    }
    window.print()
  }

  const isLoading = paramsLoading || lignesLoading || clientLoading

  // ── Téléchargement direct (PDF simple pour devis, Factur-X pour factures) ──
  const handleDownload = async () => {
    if (!parametres || isLoading) return
    if (validationErrors.length > 0) {
      alert(`Impossible de générer le document :\n\n${validationErrors.map(e => `• ${e}`).join('\n')}`)
      return
    }
    const client = docWithClient.clients as Client | undefined
    if (!client) {
      toast.error('Client introuvable')
      return
    }
    setIsDownloading(true)
    try {
      const { blob, filename, isFacturX } = await generateDownloadableDocument({
        document: docWithClient as Devis | Facture,
        type,
        lignes,
        client,
        parametres,
      })
      downloadBlob(blob, filename)
      toast.success(isFacturX ? 'Facture Factur-X téléchargée !' : 'Devis téléchargé !')
    } catch (e) {
      toast.error(`Erreur génération : ${(e as Error).message}`)
    } finally {
      setIsDownloading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] bg-slate-900/80 backdrop-blur-sm flex flex-col"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* ── Barre d'outils ──────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700 no-print">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center">
            <Printer className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              {type === 'devis' ? 'Devis' : 'Facture'} — {document.numero}
            </p>
            <p className="text-slate-400 text-xs">Aperçu avant impression / export PDF</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-1 bg-slate-700 rounded-lg px-2 py-1">
            <button
              onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
              className="p-1 text-slate-300 hover:text-white transition-colors"
              title="Zoom arrière"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-slate-300 text-xs font-mono w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(1.2, z + 0.1))}
              className="p-1 text-slate-300 hover:text-white transition-colors"
              title="Zoom avant"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Alerte mentions manquantes */}
          {validationErrors.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-500/40 rounded-lg px-3 py-1.5">
              <span className="text-red-400 text-xs font-semibold">
                ⚠ {validationErrors.join(' · ')}
              </span>
            </div>
          )}

          {/* Télécharger (PDF ou Factur-X) */}
          <button
            onClick={handleDownload}
            disabled={isLoading || isDownloading}
            className="btn-primary btn-sm gap-2"
            id="download-btn"
            title={type === 'facture' ? 'Télécharger la facture au format Factur-X (PDF/A-3 + XML)' : 'Télécharger le devis en PDF'}
          >
            {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {type === 'facture' ? 'Télécharger Factur-X' : 'Télécharger PDF'}
          </button>

          {/* Imprimer */}
          <button
            onClick={handlePrint}
            disabled={isLoading}
            className="btn-secondary btn-sm gap-2"
            id="print-btn"
          >
            <Printer size={14} />
            Imprimer
          </button>

          {/* Fermer */}
          <button onClick={onClose} className="btn-icon btn-ghost text-slate-300 hover:text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Zone d'aperçu ─────────────────────────────────── */}
      <div className="flex-1 overflow-auto py-8 px-4 flex justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-slate-600 border-t-brand-400 rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Chargement du document…</p>
            </div>
          </div>
        ) : parametres ? (
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              marginBottom: zoom < 1 ? `calc((1 - ${zoom}) * -297mm * 0.5)` : 0,
            }}
          >
            {/* Ombre du papier */}
            <div className="shadow-2xl" style={{ width: '210mm' }}>
              <div ref={printRootRef} style={{ background: 'white' }}>
                <DocumentPDF
                  document={docWithClient as Devis | Facture}
                  type={type}
                  parametres={parametres}
                  lignes={lignes}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-center py-16">
            <p className="text-lg mb-2">⚠️ Paramètres du compte manquants</p>
            <p className="text-sm">Configurez votre compte dans Paramètres pour générer le PDF.</p>
          </div>
        )}
      </div>

      {/* ── Instructions ─────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-center gap-6 px-6 py-2 bg-slate-800 border-t border-slate-700 no-print">
        <p className="text-slate-400 text-xs">
          💡 Dans la boîte de dialogue d'impression, sélectionnez <strong className="text-slate-300">«&nbsp;Enregistrer en PDF&nbsp;»</strong> pour exporter.
          Activez <strong className="text-slate-300">«&nbsp;Graphiques d'arrière-plan&nbsp;»</strong> pour les couleurs.
        </p>
      </div>
    </div>,
    window.document.body
  )
}
