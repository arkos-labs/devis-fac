import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Vérifie si les variables sont des vraies valeurs (pas des placeholders)
export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseUrl.includes('VOTRE_PROJECT_ID') &&
  !supabaseAnonKey.includes('VOTRE_ANON_KEY') &&
  supabaseUrl.startsWith('https://') &&
  supabaseUrl.includes('.supabase.co')

// Client Supabase — utilise des valeurs de fallback si non configuré
// (la connexion échouera gracieusement, affichant le guide de setup)
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)
