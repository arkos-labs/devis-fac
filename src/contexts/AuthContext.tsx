import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEMO_USER_ID } from '@/lib/mockData'
import type { User, Session } from '@supabase/supabase-js'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

// Faux utilisateur pour le mode démo
const DEMO_FAKE_USER = {
  id: DEMO_USER_ID,
  email: 'demo@cleanpro.fr',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { nom_entreprise: 'CleanPro Nettoyage' },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
} as unknown as User

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInDev: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(IS_DEMO ? DEMO_FAKE_USER : null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!IS_DEMO)

  useEffect(() => {
    // En mode démo : pas de connexion Supabase
    if (IS_DEMO) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (IS_DEMO) return { error: null }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signInDev = async () => {
    if (!import.meta.env.DEV) return { error: new Error('Disponible uniquement en développement') as Error }
    const { error } = await supabase.auth.signInAnonymously()
    return { error }
  }

  const signOut = async () => {
    if (IS_DEMO) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isDemo: IS_DEMO, signIn, signInDev, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
