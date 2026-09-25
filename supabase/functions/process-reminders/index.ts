import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmailWithResend(
  email: string,
  clientName: string,
  message: string,
  companyName: string
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured, skipping email send')
    return { success: true, emailSent: false, reason: 'No API key' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${companyName} <noreply@resend.dev>`,
        to: email,
        subject: `Relance ${companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Bonjour ${clientName},</h2>
            <p>${message}</p>
            <p>Cordialement,<br>${companyName}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">
              Cet e-mail a été envoyé automatiquement par notre système de gestion.
            </p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Resend API error:', error)
      return {
        success: false,
        emailSent: false,
        error: `Email API error: ${response.status}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      emailSent: true,
      emailId: data.id,
    }
  } catch (error) {
    console.error('Error sending email with Resend:', error)
    return {
      success: false,
      emailSent: false,
      error: error.message,
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Récupérer l'user_id depuis la requête
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      userId = user.id
    }

    // Ou depuis le body (Cron)
    const body = await req.json().catch(() => ({}))
    if (body.user_id) {
      userId = body.user_id
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer les infos utilisateur (nom entreprise)
    const { data: userParams } = await supabase
      .from('parametres_compte')
      .select('nom_entreprise')
      .eq('user_id', userId)
      .single()

    const companyName = userParams?.nom_entreprise || 'Notre Entreprise'

    // Trouver les clients à relancer
    const { data: clientsToRemind, error: selectError } = await supabase
      .rpc('get_clients_a_relancer', { p_user_id: userId })

    if (selectError) {
      console.error('Error fetching clients:', selectError)
      throw selectError
    }

    if (!clientsToRemind || clientsToRemind.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Aucun client à relancer',
          total: 0,
          results: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Envoyer les relances + emails
    const results = []
    for (const client of clientsToRemind) {
      try {
        // Enregistrer la relance en BD
        const { data: reminderResult, error: reminderError } = await supabase
          .rpc('envoyer_relance', {
            p_user_id: userId,
            p_client_id: client.client_id,
          })

        if (reminderError) {
          console.error(`Error registering reminder for ${client.client_id}:`, reminderError)
          results.push({
            client_id: client.client_id,
            nom_client: client.nom_client,
            email: client.email_client,
            success: false,
            error: reminderError.message,
          })
          continue
        }

        // Envoyer l'email si un email existe
        let emailResult = { success: true, emailSent: false }
        if (client.email_client) {
          // Récupérer le message de relance
          const { data: config } = await supabase
            .from('configuration_relances')
            .select('message_relance')
            .eq('user_id', userId)
            .single()

          const message = config?.message_relance || 'Nous aimerions renouveler notre collaboration.'

          emailResult = await sendEmailWithResend(
            client.email_client,
            client.nom_client,
            message,
            companyName
          )
        }

        results.push({
          client_id: client.client_id,
          nom_client: client.nom_client,
          email: client.email_client,
          success: true,
          reminder_registered: reminderResult?.success,
          email_sent: emailResult.emailSent,
          email_id: emailResult.emailId,
        })
      } catch (error) {
        console.error(`Error processing reminder for ${client.client_id}:`, error)
        results.push({
          client_id: client.client_id,
          nom_client: client.nom_client,
          email: client.email_client,
          success: false,
          error: error.message,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const emailSentCount = results.filter((r) => r.email_sent).length

    return new Response(
      JSON.stringify({
        success: true,
        message: `${successCount}/${results.length} relances traitées, ${emailSentCount} emails envoyés`,
        total: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
