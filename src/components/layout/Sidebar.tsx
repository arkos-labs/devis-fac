import { NavLink, useNavigate } from 'react-router-dom'
import {
  BarChart2, BookUser, ScrollText, BadgeEuro,
  SlidersHorizontal, LogOut, Zap, X
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
    <div className="h-full flex flex-col bg-white border-r border-slate-100">

      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Clean&Fresh"
              className="w-full h-full object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <p className="font-extrabold text-slate-900 text-lg tracking-tight">Clean&Fresh</p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Séparateur ────────────────────────────────────── */}
      <div className="mx-6 mb-4" />

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 px-4 flex flex-col gap-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Général</div>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                isActive
                  ? 'bg-slate-50 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn(
                  'flex-shrink-0 transition-all duration-150',
                  isActive ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-500'
                )}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-6 mb-2">Support</div>
        <button className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all duration-150 text-left">
          <span className="flex-shrink-0 text-slate-400 group-hover:text-slate-500">
            <Zap size={18} strokeWidth={2} />
          </span>
          <span className="flex-1">Génération IA</span>
        </button>
      </nav>

      {/* ── Utilisateur ───────────────────────────────────── */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-500 font-semibold hover:bg-slate-50 hover:text-slate-700 transition-all duration-150"
        >
          <LogOut size={16} strokeWidth={2} />
          Déconnexion
        </button>
      </div>
    </div>
  )
}
