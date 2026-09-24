import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatEuros, formatDate } from '@/lib/utils'
import type { DashboardStats, Devis, Facture, Client } from '@/types/database'
import {
  TrendingUp, Hourglass, ScrollText, BadgeEuro,
  AlertCircle, ArrowRight, BookUser, BarChart3,
  X, ArrowUpRight, Zap, ChevronRight,
  ClipboardCheck, Loader2, CheckCircle, Receipt, FileText
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { cn } from '@/lib/utils'
import { DEMO_STATS, DEMO_DEVIS, DEMO_FACTURES, DEMO_CHART } from '@/lib/mockData'
import toast from 'react-hot-toast'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

/* ── KPI Card ──────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, gradient, icon: Icon, onClick, pulse
}: {
  label: string; value: string; sub?: string
  gradient: string; icon: React.ElementType
  onClick?: () => void; pulse?: boolean
}) {
  return (
    <div
      className={cn(
        'kpi-card group relative',
        onClick && 'cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-brand-200'
      )}
      onClick={onClick}
    >
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
      )}

      <div className={cn('kpi-icon-wrap text-white shadow-sm', gradient)}>
        <Icon size={20} />
      </div>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
      {onClick && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1 text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Détails <ChevronRight size={10} />
        </div>
      )}
      <div className={cn('absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200', gradient)} />
    </div>
  )
}

/* ── Badges ─────────────────────────────────────────────────── */
const STATUT_DEVIS_CFG = {
  en_attente: { label: 'En attente', badge: 'badge-amber',   dot: 'bg-amber-400' },
  accepte:    { label: 'Signé',      badge: 'badge-green',   dot: 'bg-emerald-400' },
  refuse:     { label: 'Refusé',     badge: 'badge-red',     dot: 'bg-red-400' },
  expire:     { label: 'Expiré',     badge: 'badge-gray',    dot: 'bg-slate-300' },
} as const

const STATUT_FACTURE_CFG = {
  en_attente: { label: 'En attente', badge: 'badge-amber',   dot: 'bg-amber-400' },
  payee:      { label: 'Payée ✓',   badge: 'badge-green',   dot: 'bg-emerald-400' },
  retard:     { label: 'En retard', badge: 'badge-red',      dot: 'bg-red-500' },
  annulee:    { label: 'Annulée',   badge: 'badge-gray',     dot: 'bg-slate-300' },
} as const

function BadgeDevis({ statut }: { statut: string }) {
  const cfg = STATUT_DEVIS_CFG[statut as keyof typeof STATUT_DEVIS_CFG]
  return <span className={cn('badge', cfg?.badge ?? 'badge-gray')}>{cfg?.label ?? statut}</span>
}

function BadgeFacture({ statut }: { statut: string }) {
  const cfg = STATUT_FACTURE_CFG[statut as keyof typeof STATUT_FACTURE_CFG]
  return <span className={cn('badge', cfg?.badge ?? 'badge-gray')}>{cfg?.label ?? statut}</span>
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-glass text-sm">
      <p className="text-slate-400 text-xs font-semibold mb-1">{label}</p>
      <p className="text-slate-900 font-bold text-base">{formatEuros(payload[0].value)}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   DRAWER FACTURES
   mode: 'mois' | 'annuel' | 'en_attente'
══════════════════════════════════════════════════════════════ */
type FactureDrawerMode = 'mois' | 'annuel' | 'en_attente'
type FactureFilter = 'tous' | 'en_attente' | 'payee' | 'retard' | 'annulee'

const FACTURE_FILTERS: { key: FactureFilter; label: string; dotCls?: string }[] = [
  { key: 'tous',       label: 'Toutes' },
  { key: 'en_attente', label: 'En attente',  dotCls: 'bg-amber-400' },
  { key: 'retard',     label: 'En retard',   dotCls: 'bg-red-500' },
  { key: 'payee',      label: 'Payées',      dotCls: 'bg-emerald-400' },
  { key: 'annulee',    label: 'Annulées',    dotCls: 'bg-slate-300' },
]

const MOYEN_PAIEMENT_OPTIONS = [
  { value: 'virement', label: 'Virement' },
  { value: 'cheque',   label: 'Chèque' },
  { value: 'especes',  label: 'Espèces' },
  { value: 'carte',    label: 'Carte' },
  { value: 'autre',    label: 'Autre' },
]

function FacturesDrawer({ mode, onClose }: { mode: FactureDrawerMode; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const now = new Date()
  const defaultFilter: FactureFilter = mode === 'en_attente' ? 'en_attente' : 'tous'
  const [filter, setFilter] = useState<FactureFilter>(defaultFilter)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payDate, setPayDate] = useState(now.toISOString().slice(0, 10))
  const [payMoyen, setPayMoyen] = useState<string>('virement')

  const TITLE = {
    mois:       'CA ce mois',
    annuel:     'CA annuel',
    en_attente: 'Paiements en attente',
  }[mode]

  const { data: allFactures = [], isLoading } = useQuery<Facture[]>({
    queryKey: ['factures-drawer', user?.id, mode],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_FACTURES

      let query = supabase
        .from('factures').select('*, clients(nom, email)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

      if (mode === 'mois') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
        query = query.gte('date_creation', start).lte('date_creation', end)
      } else if (mode === 'annuel') {
        const start = new Date(now.getFullYear(), 0, 1).toISOString()
        const end   = new Date(now.getFullYear(), 11, 31).toISOString()
        query = query.gte('date_creation', start).lte('date_creation', end)
      } else {
        query = query.in('statut', ['en_attente', 'retard'])
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as Facture[]
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_FACTURES : undefined,
  })

  const marquerPayee = useMutation({
    mutationFn: async ({ id, date, moyen }: { id: string; date: string; moyen: string }) => {
      const { error } = await supabase.from('factures').update({
        statut: 'payee',
        date_paiement: date,
        moyen_paiement: moyen as never,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factures-drawer'] })
      qc.invalidateQueries({ queryKey: ['factures-recent'] })
      qc.invalidateQueries({ queryKey: ['factures'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setPayingId(null)
      toast.success('Facture marquée payée !')
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  const marquerRetard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('factures').update({ statut: 'retard' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factures-drawer'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const filtered = filter === 'tous' ? allFactures : allFactures.filter(f => f.statut === filter)

  const counts: Record<FactureFilter, number> = {
    tous:       allFactures.length,
    en_attente: allFactures.filter(f => f.statut === 'en_attente').length,
    payee:      allFactures.filter(f => f.statut === 'payee').length,
    retard:     allFactures.filter(f => f.statut === 'retard').length,
    annulee:    allFactures.filter(f => f.statut === 'annulee').length,
  }

  const totalFiltered = filtered.reduce((s, f) => s + f.montant_total, 0)
  const totalPayee    = allFactures.filter(f => f.statut === 'payee').reduce((s, f) => s + f.montant_total, 0)
  const totalEnAttente = allFactures.filter(f => ['en_attente', 'retard'].includes(f.statut)).reduce((s, f) => s + f.montant_total, 0)

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-base">{TITLE}</h2>
            <p className="text-xs text-slate-400">{allFactures.length} facture(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onClose(); navigate('/factures') }}
              className="btn-sm btn-secondary gap-1.5 text-xs"
            >
              Gérer <ArrowUpRight size={11} />
            </button>
            <button onClick={onClose} className="btn-icon btn-ghost"><X size={16} /></button>
          </div>
        </div>

        {/* Résumé financier */}
        <div className="grid grid-cols-2 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Encaissé</p>
            <p className="text-base font-extrabold text-emerald-700">{formatEuros(totalPayee)}</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">À encaisser</p>
            <p className="text-base font-extrabold text-amber-700">{formatEuros(totalEnAttente)}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex gap-1.5 px-4 py-3 border-b border-slate-100 overflow-x-auto">
          {FACTURE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                filter === f.key
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              )}
            >
              {f.dotCls && <span className={cn('w-1.5 h-1.5 rounded-full', f.dotCls)} />}
              {f.label}
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-extrabold',
                filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
              )}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Total du filtre actif */}
        {filter !== 'tous' && totalFiltered > 0 && (
          <div className="px-5 py-2 bg-brand-50 border-b border-brand-100">
            <p className="text-xs font-bold text-brand-700">
              Total {FACTURE_FILTERS.find(f => f.key === filter)?.label?.toLowerCase()} : {formatEuros(totalFiltered)}
            </p>
          </div>
        )}

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-300">
              <Loader2 size={28} className="mx-auto mb-3 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-semibold text-slate-400">Aucune facture</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(f => {
                const client = f.clients as Client | undefined
                const cfg = STATUT_FACTURE_CFG[f.statut as keyof typeof STATUT_FACTURE_CFG]
                const isPaying = payingId === f.id
                const isRetard = f.date_echeance && f.statut === 'en_attente'
                  && new Date(f.date_echeance) < now

                return (
                  <div key={f.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">

                    <div className="flex items-start gap-3">
                      <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', cfg?.dot ?? 'bg-slate-300')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-slate-800">{f.numero}</span>
                          <BadgeFacture statut={f.statut} />
                          {isRetard && (
                            <span className="badge badge-red text-[10px]">⚠ Retard</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {client?.nom ?? '—'}
                          <span className="text-slate-300 mx-1">·</span>
                          {formatDate(f.date_creation)}
                          {f.date_echeance && (
                            <span className={cn(
                              'ml-1',
                              isRetard ? 'text-red-500 font-bold' : 'text-slate-400'
                            )}>
                              · échéance {formatDate(f.date_echeance)}
                            </span>
                          )}
                          {f.date_paiement && (
                            <span className="ml-1 text-emerald-600 font-semibold">
                              · payée {formatDate(f.date_paiement)}
                            </span>
                          )}
                        </p>
                        {f.moyen_paiement && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            via {MOYEN_PAIEMENT_OPTIONS.find(m => m.value === f.moyen_paiement)?.label}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-extrabold text-slate-800">{formatEuros(f.montant_total)}</p>
                        {f.montant_ht !== f.montant_total && (
                          <p className="text-[10px] text-slate-400">HT {formatEuros(f.montant_ht)}</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {(f.statut === 'en_attente' || f.statut === 'retard') && !isPaying && (
                      <div className="flex items-center gap-2 mt-2.5 ml-5">
                        <button
                          onClick={() => setPayingId(f.id)}
                          className="btn-sm btn text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-0 gap-1"
                        >
                          <BadgeEuro size={10} /> Marquer payée
                        </button>
                        {f.statut === 'en_attente' && isRetard && (
                          <button
                            onClick={() => marquerRetard.mutate(f.id)}
                            className="btn-sm btn text-[11px] bg-red-50 text-red-600 hover:bg-red-100 border-0"
                          >
                            Retard
                          </button>
                        )}
                        <button
                          onClick={() => { onClose(); navigate('/factures') }}
                          className="btn-sm btn text-[11px] bg-slate-50 text-slate-500 hover:bg-slate-100 border-0 gap-1"
                        >
                          <ArrowUpRight size={10} /> Voir
                        </button>
                      </div>
                    )}

                    {/* Formulaire paiement inline */}
                    {isPaying && (
                      <div className="ml-5 mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2.5">
                        <p className="text-xs font-bold text-emerald-800">Enregistrer le paiement</p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Date</label>
                            <input
                              type="date" value={payDate}
                              onChange={e => setPayDate(e.target.value)}
                              className="input text-xs py-1.5 mt-0.5"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Moyen</label>
                            <select
                              value={payMoyen} onChange={e => setPayMoyen(e.target.value)}
                              className="input text-xs py-1.5 mt-0.5 appearance-none"
                            >
                              {MOYEN_PAIEMENT_OPTIONS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => marquerPayee.mutate({ id: f.id, date: payDate, moyen: payMoyen })}
                            disabled={marquerPayee.isPending}
                            className="btn-primary btn-sm flex-1 gap-1.5 text-xs"
                          >
                            {marquerPayee.isPending
                              ? <Loader2 size={11} className="animate-spin" />
                              : <CheckCircle size={11} />
                            }
                            Confirmer
                          </button>
                          <button
                            onClick={() => setPayingId(null)}
                            className="btn-secondary btn-sm text-xs"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   DRAWER DEVIS
══════════════════════════════════════════════════════════════ */
type DevisFilter = 'tous' | 'en_attente' | 'accepte' | 'refuse' | 'expire'

const DEVIS_FILTERS: { key: DevisFilter; label: string; dotCls?: string }[] = [
  { key: 'tous',       label: 'Tous' },
  { key: 'en_attente', label: 'En attente',  dotCls: 'bg-amber-400' },
  { key: 'accepte',    label: 'Signés',      dotCls: 'bg-emerald-400' },
  { key: 'refuse',     label: 'Refusés',     dotCls: 'bg-red-400' },
  { key: 'expire',     label: 'Expirés',     dotCls: 'bg-slate-300' },
]

function DevisDrawer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<DevisFilter>('en_attente')

  const { data: allDevis = [], isLoading } = useQuery<Devis[]>({
    queryKey: ['devis-all', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_DEVIS
      const { data, error } = await supabase
        .from('devis').select('*, clients(nom, email)')
        .eq('user_id', user!.id).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Devis[]
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_DEVIS : undefined,
  })

  const convertirEnFacture = useMutation({
    mutationFn: async (devisId: string) => {
      const { data, error } = await supabase.rpc('convertir_devis_en_facture', {
        p_devis_id: devisId, p_user_id: user!.id
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis-all'] })
      qc.invalidateQueries({ queryKey: ['devis-recent'] })
      qc.invalidateQueries({ queryKey: ['factures'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Converti en facture !')
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  const updateStatut = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase.from('devis').update({ statut }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis-all'] })
      qc.invalidateQueries({ queryKey: ['devis-recent'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const filtered = filter === 'tous' ? allDevis : allDevis.filter(d => d.statut === filter)
  const counts: Record<DevisFilter, number> = {
    tous:       allDevis.length,
    en_attente: allDevis.filter(d => d.statut === 'en_attente').length,
    accepte:    allDevis.filter(d => d.statut === 'accepte').length,
    refuse:     allDevis.filter(d => d.statut === 'refuse').length,
    expire:     allDevis.filter(d => d.statut === 'expire').length,
  }
  const totalFiltered = filtered.reduce((s, d) => s + d.montant_total, 0)

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Suivi des devis</h2>
            <p className="text-xs text-slate-400">{allDevis.length} devis au total</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); navigate('/devis') }} className="btn-sm btn-secondary gap-1.5 text-xs">
              Gérer <ArrowUpRight size={11} />
            </button>
            <button onClick={onClose} className="btn-icon btn-ghost"><X size={16} /></button>
          </div>
        </div>

        {/* Résumé */}
        <div className="grid grid-cols-2 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">En attente</p>
            <p className="text-base font-extrabold text-amber-700">{counts.en_attente} devis</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Signés</p>
            <p className="text-base font-extrabold text-emerald-700">{counts.accepte} devis</p>
          </div>
        </div>

        <div className="flex gap-1.5 px-4 py-3 border-b border-slate-100 overflow-x-auto">
          {DEVIS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                filter === f.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              )}
            >
              {f.dotCls && <span className={cn('w-1.5 h-1.5 rounded-full', f.dotCls)} />}
              {f.label}
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-extrabold',
                filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
              )}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>

        {totalFiltered > 0 && (
          <div className="px-5 py-2 bg-brand-50 border-b border-brand-100">
            <p className="text-xs font-bold text-brand-700">Total : {formatEuros(totalFiltered)}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 size={28} className="mx-auto text-slate-300 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <FileText size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-semibold text-slate-400">Aucun devis</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(d => {
                const client = d.clients as Client | undefined
                const cfg = STATUT_DEVIS_CFG[d.statut as keyof typeof STATUT_DEVIS_CFG]
                return (
                  <div key={d.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', cfg?.dot ?? 'bg-slate-300')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-slate-800">{d.numero}</span>
                          {d.genere_par_ia && <Zap size={10} className="text-amber-400" />}
                          <BadgeDevis statut={d.statut} />
                        </div>
                        <p className="text-xs text-slate-500">
                          {client?.nom ?? '—'}
                          <span className="text-slate-300 mx-1">·</span>
                          {formatDate(d.date_creation)}
                          {d.date_validite && (
                            <span className="text-slate-400"> · expire {formatDate(d.date_validite)}</span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-extrabold text-slate-800 flex-shrink-0">{formatEuros(d.montant_total)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5 ml-5">
                      {d.statut === 'en_attente' && (
                        <>
                          <button
                            onClick={() => updateStatut.mutate({ id: d.id, statut: 'accepte' })}
                            className="btn-sm btn text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-0"
                          >
                            ✓ Signé
                          </button>
                          <button
                            onClick={() => updateStatut.mutate({ id: d.id, statut: 'refuse' })}
                            className="btn-sm btn text-[11px] bg-red-50 text-red-600 hover:bg-red-100 border-0"
                          >
                            ✗ Refusé
                          </button>
                        </>
                      )}
                      {d.statut === 'accepte' && (
                        <button
                          onClick={() => confirm(`Convertir ${d.numero} en facture ?`) && convertirEnFacture.mutate(d.id)}
                          disabled={convertirEnFacture.isPending}
                          className="btn-sm btn text-[11px] bg-brand-50 text-brand-700 hover:bg-brand-100 border-0 gap-1"
                        >
                          <ArrowRight size={10} /> Facturer
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════════════════ */
type DrawerType = null | 'mois' | 'annuel' | 'en_attente' | 'devis'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [drawer, setDrawer] = useState<DrawerType>(null)

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_STATS
      const { data, error } = await supabase.rpc('get_dashboard_stats', { p_user_id: user!.id })
      if (error) throw error
      return data as DashboardStats
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_STATS : undefined,
  })

  const { data: dernierDevis = [] } = useQuery<Devis[]>({
    queryKey: ['devis-recent', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_DEVIS.slice(0, 5)
      const { data, error } = await supabase
        .from('devis').select('*, clients(nom)')
        .eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5)
      if (error) throw error
      return (data ?? []) as unknown as Devis[]
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_DEVIS.slice(0, 5) : undefined,
  })

  const { data: derniereFactures = [] } = useQuery<Facture[]>({
    queryKey: ['factures-recent', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_FACTURES.slice(0, 5)
      const { data, error } = await supabase
        .from('factures').select('*, clients(nom)')
        .eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5)
      if (error) throw error
      return (data ?? []) as unknown as Facture[]
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_FACTURES.slice(0, 5) : undefined,
  })

  const chartData = IS_DEMO ? DEMO_CHART : [
    { mois: 'Oct', ca: 1200 }, { mois: 'Nov', ca: 1800 }, { mois: 'Déc', ca: 2200 },
    { mois: 'Jan', ca: 1600 }, { mois: 'Fév', ca: 2400 }, { mois: 'Mar', ca: 3100 },
    { mois: 'Avr', ca: 2800 }, { mois: 'Mai', ca: 3600 }, { mois: 'Juin', ca: 4200 },
    { mois: 'Juil', ca: 3800 }, { mois: 'Août', ca: 4500 }, { mois: 'Sep', ca: 5200 },
  ]

  const nbEnAttente = stats?.devis_en_attente ?? 0

  const KPI_CARDS = [
    {
      label:    'CA ce mois',
      value:    formatEuros(stats?.ca_mois_courant ?? 0),
      sub:      'Encaissé · détail',
      icon:     TrendingUp,
      gradient: 'bg-gradient-kpi-blue',
      onClick:  () => setDrawer('mois'),
    },
    {
      label:    'CA annuel',
      value:    formatEuros(stats?.ca_annee_courante ?? 0),
      sub:      `${new Date().getFullYear()} · tout voir`,
      icon:     BarChart3,
      gradient: 'bg-gradient-kpi-green',
      onClick:  () => setDrawer('annuel'),
    },
    {
      label:    'À encaisser',
      value:    formatEuros(stats?.ca_a_venir ?? 0),
      sub:      'Factures en attente',
      icon:     Hourglass,
      gradient: 'bg-gradient-kpi-amber',
      onClick:  () => setDrawer('en_attente'),
      pulse:    (stats?.ca_a_venir ?? 0) > 0,
    },
    {
      label:    'Devis en attente',
      value:    `${nbEnAttente}`,
      sub:      nbEnAttente > 0 ? 'À faire signer' : 'Aucun en attente',
      icon:     ClipboardCheck,
      gradient: nbEnAttente > 0 ? 'bg-gradient-kpi-purple' : 'bg-gradient-kpi-green',
      onClick:  () => setDrawer('devis'),
      pulse:    nbEnAttente > 0,
    },
  ]

  const QUICK_ACTIONS = [
    { label: 'Nouveau devis',  icon: ScrollText,     to: '/devis',    color: 'text-brand-700 bg-brand-50 hover:bg-brand-100 border-brand-100' },
    { label: 'Tous les devis', icon: ClipboardCheck, to: '/devis',    color: 'text-violet-700 bg-violet-50 hover:bg-violet-100 border-violet-100' },
    { label: 'Factures',       icon: BadgeEuro,      to: '/factures', color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-100' },
    { label: 'Clients',        icon: BookUser,       to: '/clients',  color: 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-100' },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">

      {IS_DEMO && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-violet-50 border border-violet-200">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <span className="text-base">🎭</span>
          </div>
          <div>
            <p className="text-sm font-bold text-violet-800">Mode démo actif</p>
            <p className="text-xs text-violet-600">Données fictives — Configurez votre <code className="bg-violet-100 px-1 rounded text-violet-700">.env</code> Supabase pour passer en production.</p>
          </div>
        </div>
      )}

      {(stats?.factures_en_retard ?? 0) > 0 && (
        <button
          onClick={() => setDrawer('en_attente')}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-left"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-semibold flex-1">
            <span className="font-extrabold">{stats?.factures_en_retard}</span> facture(s) en retard de paiement
          </p>
          <ChevronRight size={16} className="text-red-400" />
        </button>
      )}

      {nbEnAttente > 0 && (
        <button
          onClick={() => setDrawer('devis')}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <FileText size={16} className="text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">{nbEnAttente} devis en attente de signature</p>
            <p className="text-xs text-amber-600">Cliquer pour voir et gérer</p>
          </div>
          <ChevronRight size={16} className="text-amber-400" />
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(card => <KpiCard key={card.label} {...card} />)}
      </div>

      {/* Chart + Actions rapides */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-slate-800">Évolution du chiffre d'affaires</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">12 derniers mois</p>
            </div>
            <span className="badge badge-blue">Annuel</span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ca" stroke="#2563eb" strokeWidth={2.5} fill="url(#gradCA)" dot={false} activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-800 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {QUICK_ACTIONS.map(({ label, icon: Icon, to, color }) => (
              <button key={label + to} onClick={() => navigate(to)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-2xl border text-sm font-semibold',
                  'transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.97]',
                  color
                )}
              >
                <Icon size={20} />
                <span className="text-center text-xs leading-tight">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Accès rapide</p>
            <button onClick={() => setDrawer('en_attente')}
              className="flex items-center justify-between w-full hover:bg-amber-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors group/row">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Paiements en attente
              </span>
              <span className="badge badge-amber text-[10px]">{formatEuros(stats?.ca_a_venir ?? 0)}</span>
            </button>
            <button onClick={() => setDrawer('devis')}
              className="flex items-center justify-between w-full hover:bg-violet-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="w-2 h-2 rounded-full bg-violet-400" /> Devis en attente
              </span>
              <span className="badge badge-purple text-[10px]">{nbEnAttente}</span>
            </button>
            <button onClick={() => setDrawer('mois')}
              className="flex items-center justify-between w-full hover:bg-blue-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="w-2 h-2 rounded-full bg-blue-400" /> CA mensuel
              </span>
              <span className="text-xs font-extrabold text-blue-700">{formatEuros(stats?.ca_mois_courant ?? 0)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tableaux récents */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-slate-800">Devis récents</h2>
            <button onClick={() => setDrawer('devis')}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-0">
            {dernierDevis.length === 0 ? (
              <div className="py-8 text-center">
                <FileText size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">Aucun devis pour l'instant</p>
              </div>
            ) : (
              dernierDevis.map((d, i) => (
                <div key={d.id} className={cn('flex items-center justify-between py-3 gap-4', i < dernierDevis.length - 1 && 'border-b border-slate-50')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{d.numero}</p>
                    <p className="text-xs text-slate-400 font-medium truncate">
                      {(d.clients as { nom: string })?.nom} · {formatDate(d.date_creation)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold text-slate-800 mb-1">{formatEuros(d.montant_total)}</p>
                    <BadgeDevis statut={d.statut} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-slate-800">Factures récentes</h2>
            <button onClick={() => setDrawer('mois')}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-0">
            {derniereFactures.length === 0 ? (
              <div className="py-8 text-center">
                <Receipt size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">Aucune facture pour l'instant</p>
              </div>
            ) : (
              derniereFactures.map((f, i) => (
                <div key={f.id} className={cn('flex items-center justify-between py-3 gap-4', i < derniereFactures.length - 1 && 'border-b border-slate-50')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{f.numero}</p>
                    <p className="text-xs text-slate-400 font-medium truncate">
                      {(f.clients as { nom: string })?.nom} · {formatDate(f.date_creation)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold text-slate-800 mb-1">{formatEuros(f.montant_total)}</p>
                    <BadgeFacture statut={f.statut} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Drawers */}
      {drawer === 'devis'      && <DevisDrawer onClose={() => setDrawer(null)} />}
      {(drawer === 'mois' || drawer === 'annuel' || drawer === 'en_attente') && (
        <FacturesDrawer mode={drawer} onClose={() => setDrawer(null)} />
      )}
    </div>
  )
}
