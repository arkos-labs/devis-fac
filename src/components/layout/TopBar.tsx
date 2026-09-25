import { Menu, Search, BarChart2, BookUser, ScrollText, BadgeEuro, SlidersHorizontal, UserRound } from 'lucide-react'
import { useLocation, useMatch } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface TopBarProps { onMenuClick: () => void }

const PAGE_META: Record<string, { title: string; icon: React.ElementType; sub: string }> = {
  '/dashboard':  { title: 'Tableau de bord',     icon: BarChart2,         sub: 'Vue d\'ensemble' },
  '/clients':    { title: 'Clients',              icon: BookUser,          sub: 'Gestion du portefeuille' },
  '/devis':      { title: 'Devis',                icon: ScrollText,        sub: 'Propositions commerciales' },
  '/factures':   { title: 'Factures',             icon: BadgeEuro,         sub: 'Facturation & paiements' },
  '/parametres': { title: 'Paramètres',           icon: SlidersHorizontal, sub: 'Configuration du compte' },
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const isClientDetail = useMatch('/clients/:id')

  const meta = isClientDetail
    ? { title: 'Fiche client', icon: UserRound, sub: 'Historique & documents' }
    : PAGE_META[pathname] ?? { title: 'CRM Pro', icon: BarChart2, sub: '' }

  const PageIcon = meta.icon
  const initials = user?.email?.[0]?.toUpperCase() ?? 'A'

  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())

  return (
    <header className="flex-shrink-0 h-16 bg-white border-b border-slate-100 px-4 md:px-6 flex items-center gap-4"
            style={{ boxShadow: '0 1px 0 0 #f1f5f9' }}>

      {/* Menu mobile */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 flex-shrink-0"
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>

      {/* Titre */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="hidden sm:flex w-8 h-8 rounded-lg bg-slate-100 items-center justify-center flex-shrink-0">
          <PageIcon size={15} className="text-slate-500" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-slate-800 leading-tight truncate">{meta.title}</h1>
          <p className="text-[11px] text-slate-400 capitalize hidden sm:block font-medium">{today}</p>
        </div>
      </div>

      {/* Droite */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={cn(
          'hidden md:flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl',
          'border border-slate-200 text-slate-400 text-sm cursor-pointer w-44',
          'hover:border-brand-300 hover:bg-brand-50/50 transition-all duration-150'
        )}>
          <Search size={13} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-400">Rechercher…</span>
          <kbd className="ml-auto text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </div>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700
                        flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-default">
          {initials}
        </div>
      </div>
    </header>
  )
}
