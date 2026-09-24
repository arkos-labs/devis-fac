import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  Eye, EyeOff, Zap, AlertTriangle, CheckCircle2,
  ExternalLink, Copy, Check, FileText, Receipt, TrendingUp, Users
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Guide de setup ─────────────────────────────────────────── */
function SetupGuide() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const steps = [
    {
      num: 1,
      title: 'Créer un projet Supabase gratuit',
      action: (
        <a href="https://supabase.com/dashboard/new" target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 underline underline-offset-2">
          supabase.com/dashboard/new <ExternalLink size={11} />
        </a>
      ),
    },
    {
      num: 2,
      title: 'Copier l\'URL et la clé Anon Key',
      action: <span className="text-xs text-slate-500">Dashboard → <strong>Settings → API</strong></span>,
    },
    {
      num: 3,
      title: 'Remplir le fichier .env',
      action: (
        <div className="mt-2 bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-400 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-500 text-[10px]">📄 .env</span>
            <button onClick={() => copy('VITE_SUPABASE_URL=https://XXXX.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...', 'env')}
                    className="text-slate-400 hover:text-white transition-colors">
              {copied === 'env' ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>
          <div><span className="text-slate-500">VITE_SUPABASE_URL</span>=https://XXXX.supabase.co</div>
          <div><span className="text-slate-500">VITE_SUPABASE_ANON_KEY</span>=eyJ...</div>
        </div>
      ),
    },
    {
      num: 4,
      title: 'Exécuter le schéma SQL dans Supabase',
      action: <span className="text-xs text-slate-500">Dashboard → <strong>SQL Editor</strong> → coller <code className="bg-slate-100 px-1 rounded">schema.sql</code></span>,
    },
    {
      num: 5,
      title: 'Créer votre compte administrateur',
      action: <span className="text-xs text-slate-500">Dashboard → <strong>Authentication → Users → Add user</strong></span>,
    },
    {
      num: 6,
      title: 'Relancer le serveur',
      action: (
        <div className="flex items-center gap-2 mt-1">
          <code onClick={() => copy('npm run dev', 'dev')}
                className="bg-slate-900 text-emerald-400 text-xs font-mono px-2 py-1 rounded cursor-pointer hover:bg-slate-800 transition-colors">
            npm run dev
          </code>
          {copied === 'dev' && <Check size={11} className="text-emerald-500" />}
        </div>
      ),
    },
  ]

  return (
    <div className="w-full max-w-lg mx-auto animate-slide-up">
      <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-amber-50 border border-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-800 text-sm">Configuration Supabase manquante</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Le fichier <code className="bg-amber-100 px-1 rounded">.env</code> contient encore des valeurs placeholder.
          </p>
        </div>
      </div>
      <div className="card space-y-5">
        <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
          <span className="w-7 h-7 rounded-full bg-brand-700 text-white text-xs flex items-center justify-center font-bold">6</span>
          Étapes de configuration
        </h2>
        <ol className="space-y-4">
          {steps.map(step => (
            <li key={step.num} className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">{step.title}</p>
                <div className="mt-1">{step.action}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <p className="text-xs text-slate-500">
            <a href="https://supabase.com/docs/guides/getting-started" target="_blank" rel="noopener noreferrer"
               className="text-brand-600 hover:underline font-semibold">
              Documentation Supabase
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Page de connexion ─────────────────────────────────────── */
export default function LoginPage() {
  const { signIn, signInDev } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const doLogin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await signIn(email, password)
      if (error) {
        const msg = error.message?.toLowerCase() ?? ''
        if (msg.includes('invalid login') || msg.includes('invalid credentials'))
          setError('Email ou mot de passe incorrect.')
        else if (msg.includes('email not confirmed'))
          setError('Email non confirmé. Vérifiez votre boîte mail.')
        else if (msg.includes('too many requests'))
          setError('Trop de tentatives. Attendez quelques minutes.')
        else
          setError(error.message)
        return
      }
      toast.success('Connexion réussie !')
      navigate('/dashboard')
    } catch {
      setError('Erreur inattendue. Vérifiez votre fichier .env')
    } finally {
      setLoading(false)
    }
  }

  const doDevLogin = async () => {
    if (!import.meta.env.DEV) return
    setError(null)
    setLoading(true)
    try {
      const { error } = await signInDev()
      if (error) { setError(`Dev: ${error.message}`); return }
      toast.success('Connexion dev !')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const FEATURES = [
    { icon: FileText,   label: 'Devis générés par IA en secondes' },
    { icon: Receipt,    label: 'Factures PDF professionnelles' },
    { icon: TrendingUp, label: 'Tableau de bord en temps réel' },
    { icon: Users,      label: 'CRM clients intégré' },
  ]

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── Panneau gauche — Branding ──────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col items-center justify-center p-12 relative overflow-hidden flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #1d4ed8 100%)' }}
      >
        {/* Orbes décoratifs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 pointer-events-none"
             style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-15 pointer-events-none"
             style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />

        <div className="relative z-10 w-full max-w-xs text-center">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-3xl bg-white/8 border border-white/10 backdrop-blur-sm flex items-center justify-center p-3"
                 style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
              <img src="/logo.png" alt="Clean&Fresh" className="w-full h-full object-contain"
                   style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Clean&Fresh</h1>
          <p className="text-sm text-slate-300 mb-10 leading-relaxed font-medium">
            Gérez vos devis, factures et clients avec l'intelligence artificielle.
          </p>

          <div className="space-y-2.5 text-left">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/6 border border-white/8">
                <div className="w-7 h-7 rounded-lg bg-brand-600/70 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-white" />
                </div>
                <span className="text-sm text-slate-200 font-medium">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/12 text-xs text-slate-300 font-semibold">
            <Zap className="w-3.5 h-3.5 text-brand-400" />
            Génération automatique de devis
          </div>
        </div>
      </div>

      {/* ── Panneau droit — Formulaire ─────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm py-8">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src="/logo.png" alt="Clean&Fresh" className="w-10 h-10 object-contain" />
            <span className="text-lg font-extrabold text-slate-800 tracking-tight">Clean&Fresh</span>
          </div>

          {!isSupabaseConfigured ? (
            <SetupGuide />
          ) : (
            <div className="animate-slide-up">
              <div className="mb-7">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bon retour 👋</h2>
                <p className="text-slate-400 text-sm mt-1.5 font-medium">Connectez-vous à votre espace de gestion</p>
              </div>

              <div className="card" style={{ boxShadow: '0 4px 32px rgba(37,99,235,0.08), 0 1px 3px rgba(0,0,0,0.06)' }}>
                <form onSubmit={doLogin} className="space-y-4">
                  <div className="form-group">
                    <label htmlFor="email" className="label">Adresse email</label>
                    <input
                      id="email" type="email" autoComplete="email" required
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="vous@exemple.fr"
                      className={error ? 'input-error' : 'input'}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="password" className="label">Mot de passe</label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password" required
                        value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${error ? 'input-error' : 'input'} pr-11`}
                      />
                      <button
                        type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 animate-slide-down">
                      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                      <span className="font-medium">{error}</span>
                    </div>
                  )}

                  <button
                    id="login-submit" type="submit" disabled={loading}
                    className="btn-primary btn-lg w-full mt-1"
                  >
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Connexion…</>
                      : 'Se connecter'
                    }
                  </button>

                  {import.meta.env.DEV && (
                    <button
                      type="button" onClick={doDevLogin} disabled={loading}
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      🛠️ Connexion rapide (dev)
                    </button>
                  )}
                </form>
              </div>

              <p className="text-xs text-center text-slate-400 mt-5 font-medium">
                Pas encore de compte ? <Link to="/signup" className="text-brand-600 font-semibold hover:text-brand-800">Créer un compte</Link>
              </p>
              <p className="text-xs text-center text-slate-400 mt-3 font-medium">
                SIRET : 99039012200028 — Auto-entrepreneur
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
