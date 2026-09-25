import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Récupérer l'user_id depuis la requête (si appelée depuis le client)
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

    // Si appelé depuis Supabase Cron, récupérer l'user_id du body
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

    // Appeler la fonction PostgreSQL pour trouver les clients à relancer
    const { data: clientsToRemind, error: selectError } = await supabase
      .rpc('get_clients_a_relancer', { p_user_id: userId })

    if (selectError) {
      console.error('Error fetching clients:', selectError)
      throw selectError
    }

    // Envoyer les relances
    const results = []
    for (const client of clientsToRemind || []) {
      const { data: reminderResult, error: reminderError } = await supabase
        .rpc('envoyer_relance', {
          p_user_id: userId,
          p_client_id: client.client_id,
        })

      if (reminderError) {
        console.error(`Error sending reminder to client ${client.client_id}:`, reminderError)
        results.push({
          client_id: client.client_id,
          success: false,
          error: reminderError.message,
        })
      } else {
        results.push({
          client_id: client.client_id,
          success: true,
          data: reminderResult,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${results.filter((r) => r.success).length} relances envoyées`,
        total: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
