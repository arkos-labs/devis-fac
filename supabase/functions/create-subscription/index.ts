import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.0'
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const stripePriceId = Deno.env.get('STRIPE_PRICE_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeSecretKey || !stripePriceId || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' })
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Récupérer ou créer l'abonnement local + le customer Stripe
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    let customerId = existing?.stripe_customer_id as string | undefined

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
    }

    // Si un abonnement existe déjà côté Stripe, se resynchroniser dessus
    // plutôt que d'en recréer un (le webhook peut avoir échoué à mettre
    // la base à jour, donc on ne se fie pas uniquement au statut local).
    if (existing?.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(existing.stripe_subscription_id, {
        expand: ['latest_invoice.payment_intent'],
      })
      const periodEnd = sub.items?.data?.[0]?.current_period_end

      await supabase.from('subscriptions').update({
        status: sub.status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      if (sub.status === 'active' || sub.status === 'trialing') {
        return new Response(JSON.stringify({ alreadyActive: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const invoice = sub.latest_invoice as Stripe.Invoice
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | undefined
      if (paymentIntent?.client_secret) {
        return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: stripePriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { supabase_user_id: user.id },
    })

    await supabase.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    const invoice = subscription.latest_invoice as Stripe.Invoice
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, subscriptionId: subscription.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('create-subscription error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
