import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/lib/useSubscription'
import { formatEuros, formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'
import type { Devis, Client } from '@/types/database'
import {
  Plus, Search, Zap, FileText,
  ArrowRight, Copy, Eye, Pencil, Download, Loader2, Archive, PenTool, Link2
} from 'lucide-react'
import PrintModal from '@/components/pdf/PrintModal'
import DevisModal, { type LigneForm, type DevisFormData } from '@/components/devis/DevisModal'
import Select from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { DEMO_DEVIS } from '@/lib/mockData'
import { useDocumentDownload } from '@/lib/useDocumentDownload'
import { useMonthArchive } from '@/lib/useMonthArchive'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

export default function DevisPage() {
  const { user } = useAuth()
  const { isActive: isSubscribed } = useSubscription()
  const qc = useQueryClient()
  const { download, downloadingId, sendByEmail } = useDocumentDownload()
  const { exportMonth, isExporting } = useMonthArchive()
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [showModal, setShowModal] = useState(false)
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null)
  const [printDoc, setPrintDoc] = useState<Devis | null>(null)
  const [exportMonthValue, setExportMonthValue] = useState(() => new Date().toISOString().slice(0, 7))

  // ── Queries ──────────────────────────────────────────────────
  const { data: devisList = [], isLoading } = useQuery<Devis[]>({
    queryKey: ['devis', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_DEVIS
      console.log('🔍 Fetching devis...')
      const { data, error } = await supabase
        .from('devis')
        .select('*, clients(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Erreur query:', error)
        throw error
      }
      console.log('✅ Devis trouvés:', data?.length ?? 0)
      return (data ?? []) as unknown as Devis[]
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_DEVIS : undefined,
  })

  // ── Mutation créer/modifier devis ────────────────────────────
  const saveDevis = useMutation({
    mutationFn: async ({ form, lignes }: { form: DevisFormData; lignes: LigneForm[]; send?: boolean }) => {
      if (!isSubscribed) throw new Error('Abonnez-vous pour créer un devis')
      let devisId: string
      const isNew = !editingDevis

      if (editingDevis) {
        const { error } = await supabase.from('devis').update({
          client_id: form.client_id,
          date_validite: form.date_validite || null,
          notes_client: form.notes_client || null,
          notes_internes: form.notes_internes || null,
          titre: form.titre || null,
          signature_activee: form.signature_activee,
          signature_token: form.signature_token,
        }).eq('id', editingDevis.id)
        if (error) throw error
        devisId = editingDevis.id
        await supabase.from('lignes_prestation')
          .delete().eq('document_id', devisId).eq('document_type', 'devis')
      } else {
        const { data: numero, error: numError } = await supabase.rpc('get_next_numero', {
          p_user_id: user!.id, p_type: 'devis'
        })
        if (numError) throw numError

        const { data: params } = await supabase
          .from('parametres_compte').select('note_google, nombre_avis_google').eq('user_id', user!.id).single()

        const { data: newDevis, error } = await supabase.from('devis').insert({
          user_id: user!.id,
          client_id: form.client_id,
          numero: numero as string,
          date_validite: form.date_validite || null,
          notes_client: form.notes_client || null,
          notes_internes: form.notes_internes || null,
          titre: form.titre || null,
          genere_par_ia: form.genere_par_ia,
          prompt_ia: form.prompt_ia || null,
          statut: 'en_attente',
          note_google_snapshot: params?.note_google ?? null,
          nombre_avis_google_snapshot: params?.nombre_avis_google ?? null,
          signature_activee: form.signature_activee,
          signature_token: form.signature_token,
        }).select().single()
        if (error) throw error
        devisId = newDevis.id
      }

      const { error: lignesError } = await supabase.from('lignes_prestation').insert(
        lignes.map((l, i) => ({
          user_id: user!.id,
          document_type: 'devis' as const,
          document_id: devisId,
          ordre: i,
          description: l.description,
          detail: l.detail || null,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire: l.prix_unitaire,
        }))
      )
      if (lignesError) throw lignesError

      if (isNew) {
        const { data: fullDevis } = await supabase
          .from('devis').select('*, clients(*)').eq('id', devisId).single()
        return fullDevis as unknown as Devis
      }
      return null
    },
    onSuccess: async (fullDevis, variables) => {
      qc.invalidateQueries({ queryKey: ['devis', user?.id] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success(editingDevis ? 'Devis mis à jour !' : 'Devis créé !')
      closeModal()
      if (variables.send && fullDevis) {
        await sendByEmail(fullDevis, 'devis', (fullDevis.clients as { email?: string } | null)?.email || '')
      }
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // ── Mutation convertir en facture ────────────────────────────
  const convertirEnFacture = useMutation({
    mutationFn: async (devisId: string) => {
      if (!isSubscribed) throw new Error('Abonnez-vous pour convertir un devis en facture')
      const { data, error } = await supabase.rpc('convertir_devis_en_facture', {
        p_devis_id: devisId, p_user_id: user!.id
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis', user?.id] })
      qc.invalidateQueries({ queryKey: ['factures'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Devis converti en facture !')
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // ── Mise à jour statut ───────────────────────────────────────
  const updateStatut = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      if (!isSubscribed) throw new Error('Abonnez-vous pour modifier un devis')
      const { error } = await supabase.from('devis').update({ statut }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis', user?.id] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // ── Dupliquer devis ──────────────────────────────────────────
  const dupliquerDevis = useMutation({
    mutationFn: async (devis: Devis) => {
      if (!isSubscribed) throw new Error('Abonnez-vous pour dupliquer un devis')
      const { data: lignesOriginales, error: errLignes } = await supabase
        .from('lignes_prestation')
        .select('*')
        .eq('document_id', devis.id)
        .eq('document_type', 'devis')
        .order('ordre')
      if (errLignes) throw errLignes

      const { data: numero, error: errNum } = await supabase.rpc('get_next_numero', {
        p_user_id: user!.id, p_type: 'devis'
      })
      if (errNum) throw errNum

      const { data: newDevis, error: errInsert } = await supabase.from('devis').insert({
        user_id: user!.id,
        client_id: devis.client_id,
        numero: numero as string,
        date_validite: devis.date_validite,
        notes_client: devis.notes_client,
        notes_internes: devis.notes_internes,
        titre: devis.titre,
        genere_par_ia: false,
        statut: 'en_attente',
        note_google_snapshot: devis.note_google_snapshot,
        nombre_avis_google_snapshot: devis.nombre_avis_google_snapshot,
      }).select().single()
      if (errInsert) throw errInsert

      if (lignesOriginales && lignesOriginales.length > 0) {
        const linesToInsert = lignesOriginales.map(l => ({
          user_id: user!.id,
          document_type: 'devis' as const,
          document_id: newDevis.id,
          ordre: l.ordre,
          description: l.description,
          detail: l.detail,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire: l.prix_unitaire,
          is_upsell: l.is_upsell
        }))
        const { error: errLignesInsert } = await supabase.from('lignes_prestation').insert(linesToInsert)
        if (errLignesInsert) throw errLignesInsert
      }
      return newDevis
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis', user?.id] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Devis dupliqué avec succès !')
    },
    onError: (e) => toast.error(`Erreur duplication : ${(e as Error).message}`),
  })

  // ── Helpers ──────────────────────────────────────────────────
  const openNew = () => { setEditingDevis(null); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditingDevis(null) }

  const filtered = devisList.filter(d => {
    const matchSearch = d.numero.includes(search) ||
      (d.clients as Client | undefined)?.nom?.toLowerCase().includes(search.toLowerCase())
    const matchStatut = filterStatut === 'tous' || d.statut === filterStatut
    return matchSearch && matchStatut
  })

  const STATUT_CONFIG: Record<string, { label: string; cls: string }> = {
    en_attente: { label: 'En attente', cls: 'badge-amber' },
    accepte:    { label: 'Accepté',    cls: 'badge-green' },
    refuse:     { label: 'Refusé',     cls: 'badge-red' },
    expire:     { label: 'Expiré',     cls: 'badge-gray' },
    facture:    { label: 'Facturé',    cls: 'badge-blue' },
    signe:      { label: 'Signé ✓',    cls: 'badge-green' },
  }

  const copierLienSignature = (d: Devis) => {
    const url = `${window.location.origin}/devis/signature/${d.signature_token}`
    navigator.clipboard.writeText(url)
    toast.success('Lien de signature copié')
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Devis</h1>
          <p className="text-sm text-slate-500">{devisList.length} devis au total</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={exportMonthValue}
            onChange={e => setExportMonthValue(e.target.value)}
            className="input text-sm"
            title="Mois à exporter"
          />
          <button
            onClick={() => exportMonth(devisList, 'devis', exportMonthValue)}
            disabled={isExporting}
            className="btn-secondary gap-2"
            title="Télécharger tous les devis du mois sélectionné dans un ZIP"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
            Exporter le mois
          </button>
        </div>
        <button
          id="add-devis-btn"
          onClick={openNew}
          disabled={!isSubscribed}
          title={isSubscribed ? undefined : 'Abonnement requis pour créer un devis'}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> Nouveau devis
        </button>
      </div>

      {!isSubscribed && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Abonnement inactif — la création et l'envoi de devis sont désactivés.{' '}
          <Link to="/abonnement" className="font-semibold underline">S'abonner</Link>
        </div>
      )}

      {/* ── Filtres ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un devis ou un client…" className="input pl-10" />
        </div>
        <Select
          value={filterStatut}
          onChange={setFilterStatut}
          className="sm:w-56"
          options={[
            { value: 'tous', label: 'Tous les statuts' },
            { value: 'en_attente', label: 'En attente' },
            { value: 'accepte', label: 'Accepté' },
            { value: 'signe', label: 'Signé' },
            { value: 'refuse', label: 'Refusé' },
            { value: 'expire', label: 'Expiré' },
            { value: 'facture', label: 'Facturé' },
          ]}
        />
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="card animate-pulse h-64" />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <FileText size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="font-semibold text-slate-500">Aucun devis trouvé</p>
          <p className="text-sm text-slate-400 mt-1">Créez votre premier devis avec l'IA.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Date</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const cfg = STATUT_CONFIG[d.statut]
                const client = d.clients as Client | undefined
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-700">{d.numero}</span>
                        {d.genere_par_ia && (
                          <Zap size={11} className="text-amber-400" />
                        )}
                        {d.signature_activee && (
                          <PenTool size={11} className="text-violet-500" />
                        )}
                      </div>
                    </td>
                    <td className="font-medium">{client?.nom ?? '—'}</td>
                    <td className="text-slate-400">{formatDate(d.date_creation)}</td>
                    <td className="font-bold">{formatEuros(d.montant_total)}</td>
                    <td>
                      {d.signature_activee ? (
                        <span
                          className={`${cfg.cls} badge font-semibold text-xs`}
                          title={
                            d.statut === 'signe' && d.signature_nom_signataire
                              ? `Signé par ${d.signature_nom_signataire}${d.signature_date ? ' le ' + formatDate(d.signature_date) : ''}`
                              : 'Signature électronique activée — le statut se met à jour automatiquement'
                          }
                        >
                          {d.statut === 'en_attente' ? 'En attente de signature' : cfg.label}
                        </span>
                      ) : (
                        <select
                          value={d.statut}
                          disabled={!isSubscribed}
                          onChange={e => updateStatut.mutate({ id: d.id, statut: e.target.value })}
                          className={`${cfg.cls} badge border-0 bg-transparent font-semibold text-xs ${isSubscribed ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                        >
                          {Object.entries(STATUT_CONFIG).filter(([k]) => k !== 'signe').map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {d.signature_activee && (
                          <button
                            title="Copier le lien de signature"
                            onClick={() => copierLienSignature(d)}
                            className="btn-icon btn-ghost btn-sm text-violet-600 hover:bg-violet-50"
                          >
                            <Link2 size={14} />
                          </button>
                        )}
                        <button
                          title={isSubscribed ? 'Modifier' : 'Abonnement requis'}
                          disabled={!isSubscribed}
                          onClick={() => { setEditingDevis(d); setShowModal(true) }}
                          className="btn-icon btn-ghost btn-sm text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="Aperçu PDF"
                          onClick={() => setPrintDoc(d)}
                          className="btn-icon btn-ghost btn-sm text-brand-600 hover:bg-brand-50"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          title="Télécharger le PDF"
                          disabled={downloadingId === d.id}
                          onClick={() => download(d, 'devis')}
                          className="btn-icon btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50 disabled:opacity-30"
                        >
                          {downloadingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </button>
                        <button
                          title={isSubscribed ? 'Convertir en facture' : 'Abonnement requis'}
                          disabled={d.statut === 'refuse' || d.statut === 'expire' || convertirEnFacture.isPending || !isSubscribed}
                          onClick={() => {
                            if (confirm(`Convertir ${d.numero} en facture ?`)) {
                              convertirEnFacture.mutate(d.id)
                            }
                          }}
                          className="btn-sm btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-30"
                        >
                          <ArrowRight size={12} /> Facturer
                        </button>
                        <button
                          title={isSubscribed ? 'Dupliquer' : 'Abonnement requis'}
                          className="btn-icon btn-ghost btn-sm disabled:opacity-30"
                          disabled={dupliquerDevis.isPending || !isSubscribed}
                          onClick={() => {
                            if (confirm(`Dupliquer le devis ${d.numero} ?`)) {
                              dupliquerDevis.mutate(d)
                            }
                          }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal PDF ────────────────────────────────────────── */}
      {printDoc && (
        <PrintModal
          document={printDoc}
          type="devis"
          onClose={() => setPrintDoc(null)}
        />
      )}

      {/* ── Modal création/édition ──────────────────────────── */}
      {showModal && (
        <DevisModal
          editingDevis={editingDevis}
          onSave={(form, lignes, send) => saveDevis.mutate({ form, lignes, send })}
          onClose={closeModal}
          isSaving={saveDevis.isPending}
        />
      )}
    </div>
  )
}
