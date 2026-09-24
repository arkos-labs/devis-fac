import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatEuros, formatDate } from '@/lib/utils'
import type { Devis, Client } from '@/types/database'
import {
  Plus, Search, Zap, FileText,
  ChevronDown, ArrowRight, Copy, Eye
} from 'lucide-react'
import PrintModal from '@/components/pdf/PrintModal'
import DevisModal, { type LigneForm, type DevisFormData } from '@/components/devis/DevisModal'
import toast from 'react-hot-toast'
import { DEMO_DEVIS } from '@/lib/mockData'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

export default function DevisPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [showModal, setShowModal] = useState(false)
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null)
  const [printDoc, setPrintDoc] = useState<Devis | null>(null)

  // ── Queries ──────────────────────────────────────────────────
  const { data: devisList = [], isLoading } = useQuery<Devis[]>({
    queryKey: ['devis', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_DEVIS
      const { data, error } = await supabase
        .from('devis').select('*, clients(nom, email, telephone)')
        .eq('user_id', user!.id).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Devis[]
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_DEVIS : undefined,
  })

  // ── Mutation créer/modifier devis ────────────────────────────
  const saveDevis = useMutation({
    mutationFn: async ({ form, lignes }: { form: DevisFormData; lignes: LigneForm[] }) => {
      let devisId: string

      if (editingDevis) {
        const { error } = await supabase.from('devis').update({
          client_id: form.client_id,
          date_validite: form.date_validite || null,
          notes_client: form.notes_client || null,
          notes_internes: form.notes_internes || null,
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
        const { data: newDevis, error } = await supabase.from('devis').insert({
          user_id: user!.id,
          client_id: form.client_id,
          numero: numero as string,
          date_validite: form.date_validite || null,
          notes_client: form.notes_client || null,
          notes_internes: form.notes_internes || null,
          genere_par_ia: form.genere_par_ia,
          prompt_ia: form.prompt_ia || null,
          statut: 'en_attente',
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
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success(editingDevis ? 'Devis mis à jour !' : 'Devis créé !')
      closeModal()
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // ── Mutation convertir en facture ────────────────────────────
  const convertirEnFacture = useMutation({
    mutationFn: async (devisId: string) => {
      const { data, error } = await supabase.rpc('convertir_devis_en_facture', {
        p_devis_id: devisId, p_user_id: user!.id
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis'] })
      qc.invalidateQueries({ queryKey: ['factures'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Devis converti en facture !')
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // ── Mise à jour statut ───────────────────────────────────────
  const updateStatut = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase.from('devis').update({ statut }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
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
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Devis</h1>
          <p className="text-sm text-slate-500">{devisList.length} devis au total</p>
        </div>
        <button id="add-devis-btn" onClick={openNew} className="btn-primary">
          <Plus size={16} /> Nouveau devis
        </button>
      </div>

      {/* ── Filtres ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un devis ou un client…" className="input pl-10" />
        </div>
        <div className="relative">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="input pr-8 appearance-none cursor-pointer">
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="accepte">Accepté</option>
            <option value="refuse">Refusé</option>
            <option value="expire">Expiré</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
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
                      </div>
                    </td>
                    <td className="font-medium">{client?.nom ?? '—'}</td>
                    <td className="text-slate-400">{formatDate(d.date_creation)}</td>
                    <td className="font-bold">{formatEuros(d.montant_total)}</td>
                    <td>
                      <select
                        value={d.statut}
                        onChange={e => updateStatut.mutate({ id: d.id, statut: e.target.value })}
                        className={`${cfg.cls} badge cursor-pointer border-0 bg-transparent font-semibold text-xs`}
                      >
                        {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          title="Aperçu PDF"
                          onClick={() => setPrintDoc(d)}
                          className="btn-icon btn-ghost btn-sm text-brand-600 hover:bg-brand-50"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          title="Convertir en facture"
                          disabled={d.statut === 'refuse' || d.statut === 'expire' || convertirEnFacture.isPending}
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
                          title="Dupliquer"
                          className="btn-icon btn-ghost btn-sm"
                          onClick={() => toast.success('Duplication — fonctionnalité à venir')}
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
          editingNumero={editingDevis?.numero}
          onSave={(form, lignes) => saveDevis.mutate({ form, lignes })}
          onClose={closeModal}
          isSaving={saveDevis.isPending}
        />
      )}
    </div>
  )
}
