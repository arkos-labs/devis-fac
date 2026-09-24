import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { DEMO_USER_ID } from '@/lib/mockData'
import { AlertTriangle, Eye, EyeOff, CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

// ── Validation SIRET ─────────────────────────────────────────
function validateSIRET(siret: string): boolean {
  const cleaned = siret.replace(/\s/g, '')
  return /^\d{14}$/.test(cleaned)
}

// ── Guide setup si Supabase pas configuré ───────────────────
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
          <span className="w-7 h-7 rounded-full bg-brand-700 text-white text-xs flex items-center justify-center font-bold">5</span>
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

// ── Page d'inscription ──────────────────────────────────────
export default function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  // Auth
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Entreprise
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [siret, setSiret] = useState('')
  const [adresse, setAdresse] = useState('')
  const [emailEntreprise, setEmailEntreprise] = useState('')
  const [telephoneEntreprise, setTelephoneEntreprise] = useState('')
  const [mentionsLegales, setMentionsLegales] = useState('')

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'auth' | 'company'>('auth')

  const doSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (step === 'auth') {
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas.')
        return
      }
      if (password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères.')
        return
      }
      setStep('company')
      return
    }

    if (step === 'company') {
      if (!nomEntreprise.trim()) {
        setError('Veuillez entrer le nom de votre entreprise.')
        return
      }
      if (!siret.trim()) {
        setError('Veuillez entrer votre SIRET.')
        return
      }
      if (!validateSIRET(siret)) {
        setError('Le SIRET est invalide (doit être 14 chiffres valides).')
        return
      }

      setLoading(true)
      try {
        let userId: string | null = null

        if (IS_DEMO) {
          userId = DEMO_USER_ID
        } else {
          const { error: signupError, user } = await signUp(email, password)
          if (signupError) {
            if (signupError.message.includes('User already registered'))
              setError('Cet email est déjà utilisé.')
            else if (signupError.message.includes('Password'))
              setError('Le mot de passe ne respecte pas les conditions.')
            else
              setError(signupError.message)
            setLoading(false)
            return
          }
          userId = user?.id ?? null
        }

        if (!userId) throw new Error('Impossible de récupérer l\'ID utilisateur')

        const { error: insertError } = await supabase
          .from('parametres_compte')
          .insert({
            user_id: userId,
            nom_entreprise: nomEntreprise,
            siret: siret.replace(/\s/g, ''),
            adresse_entreprise: adresse || null,
            email_entreprise: emailEntreprise || null,
            telephone_entreprise: telephoneEntreprise || null,
            mentions_legales: mentionsLegales || '',
            prochain_num_devis: 1,
            prochain_num_facture: 1,
            avis_google_url: null,
            note_google: 0,
            nombre_avis_google: 0,
            afficher_avis_sur_devis: true,
            afficher_avis_sur_factures: true,
          })

        if (insertError) throw insertError

        toast.success('Compte créé ! Connexion en cours…')
        setTimeout(() => navigate('/dashboard'), 1500)
      } catch (err) {
        setError((err as Error).message || 'Erreur lors de la création du compte')
      } finally {
        setLoading(false)
      }
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <SetupGuide />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Panneau gauche — Branding ──────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col items-center justify-center p-12 relative overflow-hidden flex-shrink-0"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #1d4ed8 100%)' }}
      >
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
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/6 border border-white/8">
              <div className="w-7 h-7 rounded-lg bg-brand-600/70 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">📋</span>
              </div>
              <span className="text-sm text-slate-200 font-medium">Devis générés par IA en secondes</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/6 border border-white/8">
              <div className="w-7 h-7 rounded-lg bg-brand-600/70 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">🧾</span>
              </div>
              <span className="text-sm text-slate-200 font-medium">Factures PDF professionnelles</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/6 border border-white/8">
              <div className="w-7 h-7 rounded-lg bg-brand-600/70 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">📊</span>
              </div>
              <span className="text-sm text-slate-200 font-medium">Tableau de bord en temps réel</span>
            </div>
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

          <div className="animate-slide-up">
            <div className="mb-7">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {step === 'auth' ? 'Créer un compte' : 'Infos de votre entreprise'}
              </h2>
              <p className="text-slate-400 text-sm mt-1.5 font-medium">
                {step === 'auth'
                  ? 'Étape 1/2 : Identifiants de connexion'
                  : 'Étape 2/2 : Informations professionnelles'}
              </p>
            </div>

            <div className="card" style={{ boxShadow: '0 4px 32px rgba(37,99,235,0.08), 0 1px 3px rgba(0,0,0,0.06)' }}>
              <form onSubmit={doSignup} className="space-y-4">
                {/* ── Étape 1: Auth ──────────────────────────────── */}
                {step === 'auth' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="email" className="label">Adresse email *</label>
                      <input
                        id="email" type="email" autoComplete="email" required
                        value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="vous@exemple.fr"
                        className={error ? 'input-error' : 'input'}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="password" className="label">Mot de passe *</label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password" required
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
                      <p className="text-xs text-slate-500 mt-1">Minimum 6 caractères</p>
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirm" className="label">Confirmer le mot de passe *</label>
                      <div className="relative">
                        <input
                          id="confirm"
                          type={showConfirm ? 'text' : 'password'}
                          autoComplete="new-password" required
                          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`${error ? 'input-error' : 'input'} pr-11`}
                        />
                        <button
                          type="button" onClick={() => setShowConfirm(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          aria-label={showConfirm ? 'Masquer' : 'Afficher'}
                        >
                          {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Étape 2: Infos Entreprise ──────────────────– */}
                {step === 'company' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="nom" className="label">Nom de l'entreprise *</label>
                      <input
                        id="nom" type="text" required
                        value={nomEntreprise} onChange={e => setNomEntreprise(e.target.value)}
                        placeholder="Clean&Fresh"
                        className={error ? 'input-error' : 'input'}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="siret" className="label">SIRET *</label>
                      <input
                        id="siret" type="text" required
                        value={siret} onChange={e => setSiret(e.target.value)}
                        placeholder="99 039 012 200 028"
                        className={error ? 'input-error' : 'input'}
                      />
                      <p className="text-xs text-slate-500 mt-1">14 chiffres, espaces ignorés</p>
                    </div>

                    <div className="form-group">
                      <label htmlFor="adresse" className="label">Adresse</label>
                      <input
                        id="adresse" type="text"
                        value={adresse} onChange={e => setAdresse(e.target.value)}
                        placeholder="12 rue de la Paix, Paris"
                        className="input"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="form-group">
                        <label htmlFor="email-ent" className="label">Email</label>
                        <input
                          id="email-ent" type="email"
                          value={emailEntreprise} onChange={e => setEmailEntreprise(e.target.value)}
                          placeholder="contact@clean.fr"
                          className="input"
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="tel-ent" className="label">Téléphone</label>
                        <input
                          id="tel-ent" type="tel"
                          value={telephoneEntreprise} onChange={e => setTelephoneEntreprise(e.target.value)}
                          placeholder="06 12 34 56 78"
                          className="input"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="mentions" className="label">Mentions légales</label>
                      <textarea
                        id="mentions" rows={3}
                        value={mentionsLegales} onChange={e => setMentionsLegales(e.target.value)}
                        placeholder="SIRET, conditions de paiement, etc."
                        className="input resize-none"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 animate-slide-down">
                    <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {step === 'company' && (
                    <button
                      type="button" onClick={() => { setStep('auth'); setError(null) }}
                      disabled={loading}
                      className="btn-secondary flex-1"
                    >
                      Retour
                    </button>
                  )}
                  <button
                    type="submit" disabled={loading}
                    className="btn-primary flex-1"
                  >
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {step === 'auth' ? 'Vérification…' : 'Création du compte…'}
                        </>
                      : step === 'auth' ? 'Continuer' : 'Créer le compte'
                    }
                  </button>
                </div>
              </form>
            </div>

            <p className="text-xs text-center text-slate-400 mt-5 font-medium">
              Vous avez un compte ? <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-800">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
