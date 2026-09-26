import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { CheckCircle2, CreditCard, Loader2, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

type Interval = 'month' | 'year'

const PLANS: Record<Interval, { label: string; price: string; sub: string; badge?: string }> = {
  month: { label: 'Mensuel', price: '19,99 €', sub: '/ mois, sans engagement' },
  year: { label: 'Annuel', price: '199,99 €', sub: '/ an', badge: '2 mois offerts' },
}

interface Subscription {
  status: string
  cancel_at_period_end: boolean
  current_period_end: string | null
}

function CheckoutForm({ interval, onSuccess }: { interval: Interval; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/abonnement` },
      redirect: 'if_required',
    })

    if (error) {
      toast.error(error.message ?? "Le paiement n'a pas abouti")
      setSubmitting(false)
      return
    }

    toast.success('Abonnement activé, bienvenue !')
    onSuccess()
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        S'abonner — {PLANS[interval].price} {PLANS[interval].sub}
      </button>
    </form>
  )
}

export default function AbonnementPage() {
  const { session } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [interval, setInterval] = useState<Interval>('month')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  const loadSubscription = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('status, cancel_at_period_end, current_period_end')
      .maybeSingle()
    setSubscription(data)
    return data
  }

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await loadSubscription()
      setLoading(false)
    })()
  }, [])

  const startCheckout = async (chosenInterval: Interval) => {
    if (!session) return
    setInterval(chosenInterval)
    setInitializing(true)
    setClientSecret(null)
    const { data, error } = await supabase.functions.invoke('create-subscription', {
      body: { interval: chosenInterval },
    })
    setInitializing(false)
    if (error) {
      toast.error("Impossible d'initialiser l'abonnement")
      return
    }
    if (data?.alreadyActive) {
      await loadSubscription()
      return
    }
    if (data?.clientSecret) {
      setClientSecret(data.clientSecret)
    } else {
      toast.error("Impossible d'initialiser le paiement")
    }
  }

  const openPortal = async () => {
    setPortalLoading(true)
    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: { returnUrl: `${window.location.origin}/abonnement` },
    })
    setPortalLoading(false)
    if (error || !data?.url) {
      toast.error("Impossible d'ouvrir le portail de facturation")
      return
    }
    window.location.href = data.url
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Abonnement</h1>
      <p className="text-sm text-slate-500 mb-8">Gérez votre accès au CRM — devis, factures, relances et portefeuille.</p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : isActive ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 ring-4 ring-emerald-50/60 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Abonnement actif</p>
              <p className="text-sm text-slate-500">
                {subscription?.cancel_at_period_end
                  ? `Résiliation prévue le ${subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}`
                  : `Prochain renouvellement le ${subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}`}
              </p>
            </div>
          </div>

          {subscription?.cancel_at_period_end && (
            <div className="mt-4 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Ton abonnement ne sera pas renouvelé et se terminera à la date ci-dessus.
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Changer de formule / moyen de paiement
            </button>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 font-semibold py-3 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Résilier mon abonnement
            </button>
            <p className="text-xs text-slate-400 text-center">
              La résiliation prend effet à la fin de la période déjà payée — pas de remboursement partiel.
            </p>
          </div>
        </div>
      ) : clientSecret && stripePromise ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <button
            onClick={() => setClientSecret(null)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 mb-4"
          >
            ← Changer de formule
          </button>
          <p className="font-bold text-slate-900 mb-1">Formule {PLANS[interval].label}</p>
          <p className="text-sm text-slate-500 mb-6">{PLANS[interval].price} {PLANS[interval].sub}</p>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm interval={interval} onSuccess={loadSubscription} />
          </Elements>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {(Object.entries(PLANS) as [Interval, typeof PLANS.month][]).map(([key, plan]) => (
            <div
              key={key}
              className={cn(
                'relative bg-white border rounded-2xl p-6 shadow-sm flex flex-col',
                key === 'year' ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-100'
              )}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 bg-brand-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" /> {plan.badge}
                </span>
              )}
              <p className="text-sm font-semibold text-slate-500 mb-1">{plan.label}</p>
              <p className="text-3xl font-extrabold text-slate-900 mb-1">{plan.price}</p>
              <p className="text-xs text-slate-400 mb-6">{plan.sub}</p>
              <ul className="text-sm text-slate-600 space-y-2 mb-6 flex-1">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Devis &amp; factures illimités</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Relances automatiques</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Envoi par email</li>
              </ul>
              <button
                onClick={() => startCheckout(key)}
                disabled={initializing}
                className={cn(
                  'w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50',
                  key === 'year' ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-slate-900 text-white hover:bg-slate-800'
                )}
              >
                {initializing && interval === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Choisir {plan.label.toLowerCase()}
              </button>
            </div>
          ))}
          <p className="sm:col-span-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Paiement sécurisé par Stripe — résiliable à tout moment
          </p>
        </div>
      )}
    </div>
  )
}
