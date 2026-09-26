import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

export function useSubscription() {
  const { user, isDemo } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!user && !IS_DEMO,
  })

  const isActive = IS_DEMO || isDemo || data?.status === 'active' || data?.status === 'trialing'

  return { isActive, loading: !IS_DEMO && !isDemo && isLoading }
}
