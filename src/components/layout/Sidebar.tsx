import { NavLink, useNavigate } from 'react-router-dom'
import {
  BarChart2, BookUser, ScrollText, BadgeEuro,
  SlidersHorizontal, LogOut, Zap, X, ChevronRight
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface SidebarProps { onClose: () => void }

const NAV_ITEMS = [
  { to: '/dashboard',  icon: BarChart2,          label: 'Tableau de bord' },
  { to: '/clients',    icon: BookUser,            label: 'Clients' },
  { to: '/devis',      icon: ScrollText,          label: 'Devis' },
  { to: '/factures',   icon: BadgeEuro,           label: 'Factures' },
  { to: '/parametres', icon: SlidersHorizontal,   label: 'Paramètres' },
]

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Déconnecté')
    navigate('/login')
  }

  const initials = user?.email?.[0]?.toUpperCase() ?? 'A'

  return (
    <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)' }}>

      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Clean&Fresh"
              className="w-7 h-7 object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <div>
            <p className="font-extrabold text-white text-sm leading-tight tracking-tight">Clean&Fresh</p>
            <p className="text-[10px] text-slate-500 leading-tight font-medium tracking-wide uppercase">Gestion · Facturation</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Fermer le menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Séparateur ────────────────────────────────────── */}
      <div className="mx-5 mb-4 h-px bg-white/8" />

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/12 text-white'
                  : 'text-slate-400 hover:bg-white/6 hover:text-slate-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn(
                  'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-500 group-hover:text-slate-300'
                )}>
                  <Icon size={15} />
                </span>
                <span className="flex-1 font-semibold">{label}</span>
                {isActive && (
                  <ChevronRight size={13} className="text-brand-400 opacity-50" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* ── Génération IA — discret ───────────────────── */}
        <div className="mt-5 px-3 py-3 rounded-xl border border-white/6 bg-white/3">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-brand-400 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-slate-400 leading-relaxed">
              Génération devis par IA
            </span>
          </div>
        </div>
      </nav>

      {/* ── Utilisateur ───────────────────────────────────── */}
      <div className="p-3 border-t border-white/8 mt-2">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700
                          flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.email}</p>
            <p className="text-[10px] text-slate-500 font-medium">Auto-entrepreneur</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-500
                     hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 font-medium"
        >
          <LogOut size={13} />
          Déconnexion
        </button>
      </div>
    </div>
  )
}
