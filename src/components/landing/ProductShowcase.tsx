import { useState } from 'react'
import {
  LayoutDashboard, FileText, Receipt, Users,
  TrendingUp, Hourglass, BadgeEuro, Zap, Search, Plus, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TabKey = 'dashboard' | 'devis' | 'factures' | 'clients'

const TABS: { key: TabKey; label: string; icon: React.ElementType; url: string }[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, url: 'app.cleancrm.fr/dashboard' },
  { key: 'devis',     label: 'Devis',           icon: FileText,       url: 'app.cleancrm.fr/devis' },
  { key: 'factures',  label: 'Factures',        icon: Receipt,        url: 'app.cleancrm.fr/factures' },
  { key: 'clients',   label: 'Clients',         icon: Users,          url: 'app.cleancrm.fr/clients' },
]

const KPI = [
  { label: 'CA à venir',       value: '4 280 €', icon: Hourglass,  cls: 'text-amber-600 bg-amber-50' },
  { label: 'Encaissé ce mois', value: '6 950 €', icon: BadgeEuro,  cls: 'text-emerald-600 bg-emerald-50' },
  { label: "Taux d'acceptation", value: '82 %',  icon: TrendingUp, cls: 'text-brand-600 bg-brand-50' },
]

const DEVIS_ROWS = [
  { num: 'DEV-2026-014', client: 'Marie Dupont',   montant: '480,00 €', statut: 'Accepté',    cls: 'badge-green' },
  { num: 'DEV-2026-013', client: 'SCI Bellevue',   montant: '1 250,00 €', statut: 'En attente', cls: 'badge-amber' },
  { num: 'DEV-2026-012', client: 'Julien Martin',  montant: '320,00 €', statut: 'En attente', cls: 'badge-amber' },
]

const FACTURES_ROWS = [
  { num: 'FAC-2026-031', client: 'Marie Dupont',  montant: '480,00 €',   statut: 'Payée',     cls: 'badge-green' },
  { num: 'FAC-2026-030', client: 'Hôtel Riviera', montant: '2 100,00 €', statut: 'En attente', cls: 'badge-amber' },
  { num: 'FAC-2026-029', client: 'Julien Martin', montant: '320,00 €',   statut: 'En retard',  cls: 'badge-red' },
]

const CLIENTS_ROWS = [
  { nom: 'Marie Dupont',   sub: 'Particulier — Paris 15e' },
  { nom: 'SCI Bellevue',   sub: 'Professionnel — Lyon' },
  { nom: 'Julien Martin',  sub: 'Particulier — Toulouse' },
  { nom: 'Hôtel Riviera',  sub: 'Professionnel — Nice' },
]

export default function ProductShowcase() {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const active = TABS.find(t => t.key === tab)!

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Un aperçu de votre futur outil</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Toute la gestion de votre activité — devis, factures, clients — réunie dans une interface simple et rapide.
          </p>
        </div>

        {/* ── Sélecteur d'écran ── */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {TABS.map(t => {
            const Icon = t.icon
            const isActive = t.key === tab
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-brand-600 text-white shadow-card-hover'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                )}
              >
                <Icon size={15} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* ── Fenêtre navigateur simulée ── */}
        <div className="rounded-3xl shadow-glass-lg border border-slate-200 overflow-hidden bg-white max-w-4xl mx-auto">
          {/* Barre de fenêtre */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-100 border-b border-slate-200">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-1 rounded-lg bg-white text-[11px] text-slate-400 font-medium border border-slate-200 max-w-xs w-full text-center truncate">
                {active.url}
              </div>
            </div>
          </div>

          {/* Contenu simulé */}
          <div className="p-5 sm:p-7 bg-slate-50/60 min-h-[420px]">

            {tab === 'dashboard' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Tableau de bord</h3>
                  <p className="text-xs text-slate-400">Vue d'ensemble de votre activité</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {KPI.map(k => (
                    <div key={k.label} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center mb-4', k.cls)}>
                        <k.icon size={16} strokeWidth={2.5} />
                      </div>
                      <p className="text-[12px] font-medium text-slate-500 mb-1">{k.label}</p>
                      <p className="text-xl font-extrabold text-slate-800">{k.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'devis' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Devis</h3>
                    <p className="text-xs text-slate-400">3 devis au total</p>
                  </div>
                  <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-sm">
                    <Plus size={13} /> Nouveau devis
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-300 text-xs">
                  <Search size={13} /> Rechercher un devis ou un client…
                </div>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  {DEVIS_ROWS.map((r, i) => (
                    <div key={r.num} className={cn('flex items-center justify-between px-4 py-3 text-sm', i !== 0 && 'border-t border-slate-100')}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Zap size={11} className="text-amber-400 flex-shrink-0" />
                        <span className="font-bold text-brand-700">{r.num}</span>
                        <span className="text-slate-500 truncate">{r.client}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-bold text-slate-700">{r.montant}</span>
                        <span className={cn('badge text-[10px]', r.cls)}>{r.statut}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'factures' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Factures</h3>
                    <p className="text-xs text-slate-400">Conforme loi anti-fraude</p>
                  </div>
                  <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    <ChevronDown size={13} /> Tous les statuts
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border-l-4 border-l-amber-400 rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400 mb-1">À encaisser</p>
                    <p className="text-lg font-extrabold text-amber-600">2 420,00 €</p>
                  </div>
                  <div className="bg-white border-l-4 border-l-emerald-400 rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400 mb-1">Encaissé</p>
                    <p className="text-lg font-extrabold text-emerald-600">480,00 €</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  {FACTURES_ROWS.map((r, i) => (
                    <div key={r.num} className={cn('flex items-center justify-between px-4 py-3 text-sm', i !== 0 && 'border-t border-slate-100')}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-brand-700">{r.num}</span>
                        <span className="text-slate-500 truncate">{r.client}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-bold text-slate-700">{r.montant}</span>
                        <span className={cn('badge text-[10px]', r.cls)}>{r.statut}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'clients' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Clients</h3>
                    <p className="text-xs text-slate-400">4 clients enregistrés</p>
                  </div>
                  <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-sm">
                    <Plus size={13} /> Nouveau client
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {CLIENTS_ROWS.map(c => (
                    <div key={c.nom} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                      <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center flex-shrink-0">
                        {c.nom.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{c.nom}</p>
                        <p className="text-xs text-slate-400 truncate">{c.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}
