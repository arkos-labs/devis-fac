import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { CheckCircle2, CreditCard, Loader2, Sparkles, ShieldCheck, CalendarClock, RotateCcw } from 'lucide-react'
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
  plan_interval: Interval | null
}

function CheckoutForm({ interval, onSuccess, onRetry }: { interval: Interval; onSuccess: () => void; onRetry: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [elementReady, setElementReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

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

  if (loadFailed) {
    return (
      <div className="text-sm text-slate-600 space-y-3">
        <p>Le formulaire de paiement n'a pas pu se charger. Réessaie.</p>
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 transition-colors"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        onReady={() => setElementReady(true)}
        onLoadError={() => setLoadFailed(true)}
      />
      <button
        type="submit"
        disabled={!stripe || !elementReady || submitting}
        className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        S'abonner — {PLANS[interval].price} {PLANS[interval].sub}
      </button>
    </form>
  )
}

function PlanCard({
  plan, planKey, current, disabled, loading, onSelect, ctaLabel,
}: {
  plan: typeof PLANS.month; planKey: Interval; current: boolean
  disabled: boolean; loading: boolean; onSelect: () => void; ctaLabel: string
}) {
  return (
    <div
      className={cn(
        'relative bg-white border rounded-2xl p-6 shadow-sm flex flex-col',
        current ? 'border-emerald-300 ring-2 ring-emerald-100' : planKey === 'year' ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-100'
      )}
    >
      {current ? (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
          <CheckCircle2 className="w-3 h-3" /> Formule actuelle
        </span>
      ) : plan.badge ? (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 bg-brand-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
          <Sparkles className="w-3 h-3" /> {plan.badge}
        </span>
      ) : null}
      <p className="text-sm font-semibold text-slate-500 mb-1">{plan.label}</p>
      <p className="text-3xl font-extrabold text-slate-900 mb-1">{plan.price}</p>
      <p className="text-xs text-slate-400 mb-6">{plan.sub}</p>
      <ul className="text-sm text-slate-600 space-y-2 mb-6 flex-1">
        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Devis &amp; factures illimités</li>
        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Relances automatiques</li>
        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Envoi par email</li>
      </ul>
      <button
        onClick={onSelect}
        disabled={disabled || current}
        className={cn(
          'w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50',
          current
            ? 'bg-emerald-50 text-emerald-700 cursor-default'
            : planKey === 'year' ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-slate-900 text-white hover:bg-slate-800'
        )}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {current ? 'Formule en cours' : ctaLabel}
      </button>
    </div>
  )
}

export default function AbonnementPage() {
  const { session } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [interval, setInterval] = useState<Interval>('month')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [switching, setSwitching] = useState<Interval | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const loadSubscription = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('status, cancel_at_period_end, current_period_end, plan_interval')
      .maybeSingle()
    setSubscription(data)
    return data
  }

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const periodEndLabel = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR')
    : '—'

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

  const switchPlan = async (chosenInterval: Interval) => {
    setSwitching(chosenInterval)
    const { data, error } = await supabase.functions.invoke('update-subscription-plan', {
      body: { interval: chosenInterval },
    })
    setSwitching(null)
    if (error || !data?.success) {
      toast.error('Impossible de changer de formule')
      return
    }
    toast.success(`Formule ${PLANS[chosenInterval].label.toLowerCase()} activée`)
    await loadSubscription()
  }

  const cancelSubscription = async () => {
    setCancelBusy(true)
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: { cancel: true },
    })
    setCancelBusy(false)
    setConfirmingCancel(false)
    if (error || !data?.success) {
      toast.error("Impossible d'annuler l'abonnement")
      return
    }
    toast.success('Abonnement annulé — actif jusqu\'à la fin de la période en cours')
    await loadSubscription()
  }

  const reactivateSubscription = async () => {
    setCancelBusy(true)
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: { cancel: false },
    })
    setCancelBusy(false)
    if (error || !data?.success) {
      toast.error('Impossible de réactiver l\'abonnement')
      return
    }
    toast.success('Abonnement réactivé, il sera bien renouvelé')
    await loadSubscription()
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
        <div className="space-y-5">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 ring-4 ring-emerald-50/60 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Abonnement actif</p>
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {subscription?.cancel_at_period_end
                    ? `Actif jusqu'au ${periodEndLabel}, puis résilié`
                    : `Prochain renouvellement le ${periodEndLabel}`}
                </p>
              </div>
            </div>

            {subscription?.cancel_at_period_end && (
              <div className="mt-4 flex items-center justify-between gap-3 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <span>Ton abonnement ne sera pas renouvelé. Il reste utilisable jusqu'au {periodEndLabel}.</span>
                <button
                  onClick={reactivateSubscription}
                  disabled={cancelBusy}
                  className="flex-shrink-0 flex items-center gap-1 font-bold text-amber-800 hover:text-amber-900 underline"
                >
                  {cancelBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Annuler la résiliation
                </button>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {(Object.entries(PLANS) as [Interval, typeof PLANS.month][]).map(([key, plan]) => (
              <PlanCard
                key={key}
                plan={plan}
                planKey={key}
                current={subscription?.plan_interval === key}
                disabled={switching !== null}
                loading={switching === key}
                onSelect={() => switchPlan(key)}
                ctaLabel={key === 'year' ? 'Passer à l\'annuel' : 'Passer au mensuel'}
              />
            ))}
          </div>

          {!subscription?.cancel_at_period_end && (
            confirmingCancel ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <p className="text-sm font-semibold text-red-800 mb-1">Confirmer l'annulation ?</p>
                <p className="text-xs text-red-700 mb-4">
                  Ton abonnement restera <strong>actif jusqu'au {periodEndLabel}</strong> (fin de la période déjà payée), puis ne sera pas renouvelé. Pas de remboursement partiel.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmingCancel(false)}
                    className="flex-1 border border-red-200 text-red-700 font-semibold py-2.5 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    Garder mon abonnement
                  </button>
                  <button
                    onClick={cancelSubscription}
                    disabled={cancelBusy}
                    className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cancelBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Oui, annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingCancel(true)}
                className="w-full text-sm font-semibold text-red-600 hover:text-red-700 py-2"
              >
                Annuler mon abonnement
              </button>
            )
          )}
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
          <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm interval={interval} onSuccess={loadSubscription} onRetry={() => startCheckout(interval)} />
          </Elements>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {(Object.entries(PLANS) as [Interval, typeof PLANS.month][]).map(([key, plan]) => (
            <PlanCard
              key={key}
              plan={plan}
              planKey={key}
              current={false}
              disabled={initializing}
              loading={initializing && interval === key}
              onSelect={() => startCheckout(key)}
              ctaLabel={`Choisir ${plan.label.toLowerCase()}`}
            />
          ))}
          <p className="sm:col-span-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Paiement sécurisé par Stripe — résiliable à tout moment
          </p>
        </div>
      )}
    </div>
  )
}
