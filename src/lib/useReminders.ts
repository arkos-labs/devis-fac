import { useCallback, useState } from 'react'
import { supabase } from './supabase'
import toast from 'react-hot-toast'
import type { ClientARelancer, ConfigurationRelances } from '../types/database'

export function useReminders() {
  const [loading, setLoading] = useState(false)
  const [clientsToRemind, setClientsToRemind] = useState<ClientARelancer[]>([])

  // Récupérer la configuration des relances
  const fetchConfiguration = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('configuration_relances')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return (data || {
        user_id: user.id,
        mois_sans_activite: 6,
        message_relance:
          'Bonjour, nous aimerions renouveler notre collaboration. N\'hésitez pas à nous recontacter.',
        actif: true,
      }) as ConfigurationRelances
    } catch (err) {
      console.error('Error fetching configuration:', err)
      throw err
    }
  }, [])

  // Mettre à jour la configuration
  const updateConfiguration = useCallback(
    async (mois_sans_activite: number, message_relance: string, actif: boolean) => {
      try {
        setLoading(true)
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { error } = await supabase
          .from('configuration_relances')
          .update({
            mois_sans_activite,
            message_relance,
            actif,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)

        if (error) throw error

        toast.success('Configuration mise à jour ✓')
        return true
      } catch (err) {
        console.error('Error updating configuration:', err)
        toast.error('Erreur lors de la mise à jour')
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Récupérer les clients à relancer
  const fetchClientsToRemind = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.rpc('get_clients_a_relancer', {
        p_user_id: user.id,
      })

      if (error) throw error

      setClientsToRemind(data || [])
      return data || []
    } catch (err) {
      console.error('Error fetching clients to remind:', err)
      toast.error('Erreur lors de la récupération des clients')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Envoyer une relance à un client
  const sendReminder = useCallback(async (clientId: string) => {
    try {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.rpc('envoyer_relance', {
        p_user_id: user.id,
        p_client_id: clientId,
      })

      if (error) throw error

      if (data.success) {
        toast.success(`Client relancé ✓`, {
          duration: 3000,
          icon: '📧',
        })

        // Mettre à jour la liste
        setClientsToRemind((prev) => prev.filter((c) => c.client_id !== clientId))
        return true
      } else {
        toast.error(data.error || 'Erreur')
        return false
      }
    } catch (err) {
      console.error('Error sending reminder:', err)
      toast.error('Erreur lors de l\'envoi de la relance')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // Déclencher les relances automatiques (via edge function)
  const triggerAutomaticReminders = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-reminders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        toast.success(result.message || 'Relances envoyées ✓', {
          duration: 4000,
          icon: '🚀',
        })

        // Recharger les clients
        await fetchClientsToRemind()
        return result
      } else {
        toast.error(result.error || 'Erreur lors de l\'envoi des relances')
        return null
      }
    } catch (err) {
      console.error('Error triggering automatic reminders:', err)
      toast.error('Erreur lors du déclenchement des relances')
      return null
    } finally {
      setLoading(false)
    }
  }, [fetchClientsToRemind])

  return {
    loading,
    clientsToRemind,
    fetchConfiguration,
    updateConfiguration,
    fetchClientsToRemind,
    sendReminder,
    triggerAutomaticReminders,
  }
}
