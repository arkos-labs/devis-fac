import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

const PLAN_PRICE = '19,99 €'

interface Subscription {
  status: string
  cancel_at_period_end: boolean
  current_period_end: string | null
}

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
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
        S'abonner — {PLAN_PRICE}/mois
      </button>
    </form>
  )
}

export default function AbonnementPage() {
  const { session } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  const loadSubscription = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('status, cancel_at_period_end, current_period_end')
      .maybeSingle()
    setSubscription(data)
    return data
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const sub = await loadSubscription()
      const isActive = sub?.status === 'active' || sub?.status === 'trialing'
      if (!isActive && session) {
        const { data, error } = await supabase.functions.invoke('create-subscription')
        if (error) {
          toast.error("Impossible d'initialiser l'abonnement")
        } else if (data?.clientSecret) {
          setClientSecret(data.clientSecret)
        }
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

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

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Abonnement</h1>
      <p className="text-sm text-slate-500 mb-8">Gérez votre accès au CRM.</p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : isActive ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="font-bold text-slate-900">Abonnement actif</p>
              <p className="text-sm text-slate-500">
                {subscription?.cancel_at_period_end
                  ? `Prend fin le ${subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}`
                  : `Renouvellement le ${subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}`}
              </p>
            </div>
          </div>
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {portalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Gérer mon abonnement
          </button>
        </div>
      ) : clientSecret && stripePromise ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <p className="font-bold text-slate-900 mb-1">Abonnement CRM</p>
          <p className="text-sm text-slate-500 mb-6">{PLAN_PRICE} / mois, sans engagement.</p>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm onSuccess={loadSubscription} />
          </Elements>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm text-sm text-slate-500">
          La configuration du paiement est incomplète. Vérifiez la clé Stripe publique.
        </div>
      )}
    </div>
  )
}
