import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatEuros, formatDate } from '@/lib/utils'
import type { Facture, Client } from '@/types/database'
import {
  Search, ChevronDown, Receipt, CheckCircle,
  AlertCircle, Clock, X, Eye, RotateCcw, Info, Download, Loader2, Archive
} from 'lucide-react'
import toast from 'react-hot-toast'
import PrintModal from '@/components/pdf/PrintModal'
import { DEMO_FACTURES } from '@/lib/mockData'
import { cn } from '@/lib/utils'
import { useDocumentDownload } from '@/lib/useDocumentDownload'
import { useMonthArchive } from '@/lib/useMonthArchive'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

const STATUT_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  en_attente: { label: 'En attente', cls: 'badge-amber', icon: Clock },
  payee:      { label: 'Payée ✓',   cls: 'badge-green', icon: CheckCircle },
  retard:     { label: 'En retard', cls: 'badge-red',    icon: AlertCircle },
  annulee:    { label: 'Annulée',   cls: 'badge-gray',   icon: X },
}

const MOYENS = [
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'cheque',   label: 'Chèque' },
  { value: 'especes',  label: 'Espèces' },
  { value: 'carte',    label: 'Carte bancaire' },
  { value: 'autre',    label: 'Autre' },
]

export default function FacturesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { download, downloadingId } = useDocumentDownload()
  const { exportMonth, isExporting } = useMonthArchive()
  const [exportMonthValue, setExportMonthValue] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch]           = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [payingFacture, setPayingFacture] = useState<Facture | null>(null)
  const [payMoyen, setPayMoyen]       = useState('virement')
  const [payDate, setPayDate]         = useState(new Date().toISOString().slice(0, 10))
  const [printDoc, setPrintDoc]       = useState<Facture | null>(null)
  const [avoirTarget, setAvoirTarget] = useState<Facture | null>(null)

  // ── Query ────────────────────────────────────────────────────
  const { data: factures = [], isLoading } = useQuery<Facture[]>({
    queryKey: ['factures', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_FACTURES
      const { data, error } = await supabase
        .from('factures')
        .select('*, clients(nom, email, telephone, adresse, ville, code_postal), devis(numero)')
        .eq('user_id', user!.id).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Facture[]
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_FACTURES : undefined,
  })

  // ── Marquer payée ────────────────────────────────────────────
  const markPaid = useMutation({
    mutationFn: async ({ id, moyen, date }: { id: string; moyen: string; date: string }) => {
      const { error } = await supabase.from('factures').update({
        statut: 'payee',
        date_paiement: date,
        moyen_paiement: moyen,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factures'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['factures-drawer'] })
      toast.success('Paiement enregistré ✓')
      setPayingFacture(null)
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // ── Marquer retard ───────────────────────────────────────────
  const markRetard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('factures').update({ statut: 'retard' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factures'] }),
  })

  // ── Créer un Avoir ───────────────────────────────────────────
  // Un Avoir = nouvelle facture avec montant négatif, liée à la facture annulée
  const creerAvoir = useMutation({
    mutationFn: async (facture: Facture) => {
      // 1. Générer numéro
      const { data: numero, error: numErr } = await supabase.rpc('get_next_numero', {
        p_user_id: user!.id, p_type: 'facture'
      })
      if (numErr) throw numErr

      // 2. Créer l'avoir
      const { data: avoir, error: avoirErr } = await supabase.from('factures').insert({
        user_id:              user!.id,
        client_id:            facture.client_id,
        devis_id:             null,
        numero:               numero as string,
        date_creation:        new Date().toISOString(),
        date_echeance:        new Date().toISOString(),
        statut:               'payee',
        montant_ht:           -facture.montant_ht,
        montant_total:        -facture.montant_total,
        notes_client:         `Avoir pour annulation de la facture ${facture.numero}`,
        avoir_de_facture_id:  facture.id,
        note_google_snapshot: (facture as any).note_google_snapshot,
        nombre_avis_google_snapshot: (facture as any).nombre_avis_google_snapshot,
      }).select().single()
      if (avoirErr) throw avoirErr

      // 3. Dupliquer les lignes en négatif
      const { data: lignes } = await supabase
        .from('lignes_prestation')
        .select('*')
        .eq('document_id', facture.id)
        .eq('document_type', 'facture')

      if (lignes && lignes.length > 0) {
        await supabase.from('lignes_prestation').insert(
          lignes.map(l => ({
            user_id:       user!.id,
            document_type: 'facture' as const,
            document_id:   avoir.id,
            ordre:         l.ordre,
            description:   l.description,
            detail:        l.detail,
            quantite:      l.quantite,
            unite:         l.unite,
            prix_unitaire: -Math.abs(l.prix_unitaire),
          }))
        )
      }

      // 4. Marquer la facture originale comme annulée
      await supabase.from('factures').update({ statut: 'annulee' }).eq('id', facture.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factures'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['factures-drawer'] })
      toast.success('Avoir créé — facture annulée ✓')
      setAvoirTarget(null)
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // ── Filtres ──────────────────────────────────────────────────
  const filtered = factures.filter(f => {
    const client = f.clients as Client | undefined
    const matchSearch = f.numero.includes(search) ||
      client?.nom?.toLowerCase().includes(search.toLowerCase())
    const matchStatut = filterStatut === 'tous' || f.statut === filterStatut
    return matchSearch && matchStatut
  })

  const totalEnAttente = factures
    .filter(f => ['en_attente', 'retard'].includes(f.statut) && f.montant_total > 0)
    .reduce((s, f) => s + f.montant_total, 0)
  const totalPayees = factures
    .filter(f => f.statut === 'payee' && f.montant_total > 0)
    .reduce((s, f) => s + f.montant_total, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Factures</h1>
          <p className="text-sm text-slate-500">{factures.filter(f => f.montant_total > 0).length} facture(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={exportMonthValue}
            onChange={e => setExportMonthValue(e.target.value)}
            className="input text-sm"
            title="Mois à exporter"
          />
          <button
            onClick={() => exportMonth(factures, 'facture', exportMonthValue)}
            disabled={isExporting}
            className="btn-secondary gap-2"
            title="Télécharger toutes les factures du mois sélectionné dans un ZIP"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
            Exporter le mois
          </button>
          {/* Mention conformité */}
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <CheckCircle size={12} />
            Conforme loi anti-fraude
          </div>
        </div>
      </div>

      {/* ── Résumé financier ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card border-l-4 border-l-amber-400">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Clock size={12} /> À encaisser
          </p>
          <p className="text-2xl font-bold text-amber-600">{formatEuros(totalEnAttente)}</p>
        </div>
        <div className="card border-l-4 border-l-emerald-400">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <CheckCircle size={12} /> Encaissé
          </p>
          <p className="text-2xl font-bold text-emerald-600">{formatEuros(totalPayees)}</p>
        </div>
      </div>

      {/* ── Bandeau légal ───────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-blue-50 border border-blue-200">
        <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Inaltérabilité :</strong> les factures émises ne peuvent pas être modifiées ni supprimées (loi anti-fraude TVA 2018).
          Pour corriger une erreur, utilisez le bouton <strong>Rembourser</strong> — cela génère une facture d'annulation en négatif et crée automatiquement un nouveau numéro séquentiel.
        </p>
      </div>

      {/* ── Filtres ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une facture ou un client…" className="input pl-10" />
        </div>
        <div className="relative">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="input pr-8 appearance-none cursor-pointer">
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="payee">Payées</option>
            <option value="retard">En retard</option>
            <option value="annulee">Annulées / Avoirs</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="card animate-pulse h-64" />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Receipt size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="font-semibold text-slate-500">Aucune facture trouvée</p>
          <p className="text-sm text-slate-400 mt-1">Convertissez un devis accepté en facture.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Émise le</th>
                <th>Échéance</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const client   = f.clients as Client | undefined
                const cfg      = STATUT_CONFIG[f.statut]
                const StatusIcon = cfg.icon
                const isAvoir  = f.avoir_de_facture_id != null
                const isOverdue = f.statut === 'en_attente' &&
                  f.date_echeance && new Date(f.date_echeance) < new Date()

                return (
                  <tr key={f.id} className={cn(
                    isOverdue && 'bg-red-50/40',
                    isAvoir   && 'bg-violet-50/30'
                  )}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-700">{f.numero}</span>
                        {isAvoir && (
                          <span className="badge badge-purple text-[10px]">REMBOURSÉ</span>
                        )}
                      </div>
                      {f.devis_id && (
                        <p className="text-xs text-slate-400">
                          Via {(f.devis as { numero?: string } | null)?.numero}
                        </p>
                      )}
                      {isAvoir && (
                        <p className="text-xs text-violet-500">
                          Annule {factures.find(x => x.id === f.avoir_de_facture_id)?.numero ?? '—'}
                        </p>
                      )}
                    </td>
                    <td className="font-medium">{client?.nom ?? '—'}</td>
                    <td className="text-slate-400">{formatDate(f.date_creation)}</td>
                    <td className={isOverdue ? 'text-red-500 font-semibold' : 'text-slate-400'}>
                      {f.date_echeance ? formatDate(f.date_echeance) : '—'}
                      {isOverdue && <span className="block text-[10px] text-red-400">⚠ Retard</span>}
                    </td>
                    <td className={cn('font-bold', f.montant_total < 0 && 'text-violet-700')}>
                      {formatEuros(f.montant_total)}
                    </td>
                    <td>
                      <span className={cn('badge', cfg.cls)}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {/* Aperçu PDF */}
                        <button title="Aperçu PDF" onClick={() => setPrintDoc(f)}
                          className="btn-icon btn-ghost btn-sm text-brand-600 hover:bg-brand-50">
                          <Eye size={14} />
                        </button>

                        {/* Télécharger Factur-X */}
                        <button
                          title="Télécharger la facture (Factur-X)"
                          disabled={downloadingId === f.id}
                          onClick={() => download(f, 'facture')}
                          className="btn-icon btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50 disabled:opacity-30"
                        >
                          {downloadingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </button>

                        {/* Marquer payée */}
                        {(f.statut === 'en_attente' || f.statut === 'retard') && !isAvoir && (
                          <button onClick={() => { setPayingFacture(f); setPayDate(new Date().toISOString().slice(0,10)) }}
                            className="btn-sm btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-0 gap-1">
                            <CheckCircle size={11} /> Payée
                          </button>
                        )}

                        {/* Marquer en retard */}
                        {f.statut === 'en_attente' && isOverdue && (
                          <button onClick={() => markRetard.mutate(f.id)}
                            className="btn-sm btn bg-red-50 text-red-600 hover:bg-red-100 border-0 text-[11px]">
                            Retard
                          </button>
                        )}

                        {/* Créer un Avoir — remplace la suppression */}
                        {f.statut !== 'annulee' && !isAvoir && (
                          <button title="Créer un Avoir (annulation légale)"
                            onClick={() => setAvoirTarget(f)}
                            className="btn-sm btn bg-violet-50 text-violet-700 hover:bg-violet-100 border-0 gap-1">
                            <RotateCcw size={11} /> Rembourser
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal PDF ─────────────────────────────────────────── */}
      {printDoc && (
        <PrintModal document={printDoc} type="facture" onClose={() => setPrintDoc(null)} />
      )}

      {/* ── Modal paiement ────────────────────────────────────── */}
      {payingFacture && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setPayingFacture(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Enregistrer le paiement</h2>
                <p className="text-sm text-slate-500">
                  {payingFacture.numero} — {formatEuros(payingFacture.montant_total)}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="form-group">
                <label className="label">Date de réception *</label>
                <input type="date" className="input" value={payDate}
                  onChange={e => setPayDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Moyen de paiement *</label>
                <div className="relative">
                  <select className="input appearance-none pr-8" value={payMoyen}
                    onChange={e => setPayMoyen(e.target.value)}>
                    {MOYENS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPayingFacture(null)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={() => markPaid.mutate({ id: payingFacture.id, moyen: payMoyen, date: payDate })}
                disabled={markPaid.isPending || !payDate}
                className="btn-primary flex-1"
              >
                {markPaid.isPending ? 'Enregistrement…' : 'Confirmer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Avoir ───────────────────────────────────────── */}
      {avoirTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setAvoirTarget(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Rembourser / annuler cette facture</h2>
                <p className="text-xs text-slate-400">{avoirTarget.numero}</p>
              </div>
            </div>

            {/* Explication simple */}
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 mb-5 space-y-2">
              <p className="text-sm font-bold text-red-800">Effet immédiat :</p>
              <div className="space-y-1.5 text-sm text-red-700">
                <p>✓ Facture <strong>{avoirTarget.numero}</strong> marquée <em>Annulée</em></p>
                <p>✓ Client remboursé de <strong>{formatEuros(avoirTarget.montant_total)}</strong></p>
                <p>✓ Montant retiré du CA (compté en négatif)</p>
              </div>
            </div>

            {/* Détail technique light */}
            <div className="text-xs text-slate-500 mb-6 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-semibold text-slate-600 mb-1">Techniquement :</p>
              <p>Un remboursement = facture négative qui annule l'original. Les deux restent en historique (loi).</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setAvoirTarget(null)} className="btn-secondary flex-1 text-sm">
                Garder la facture
              </button>
              <button
                onClick={() => creerAvoir.mutate(avoirTarget)}
                disabled={creerAvoir.isPending}
                className="btn flex-1 bg-red-600 hover:bg-red-700 text-white text-sm gap-1.5"
              >
                {creerAvoir.isPending ? 'Annulation…' : 'Oui, annuler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
