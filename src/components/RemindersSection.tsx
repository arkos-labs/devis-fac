import { useEffect, useState } from 'react'
import { Bell, Loader2, Send, AlertCircle } from 'lucide-react'
import { useReminders } from '../lib/useReminders'
import type { ConfigurationRelances } from '../types/database'

export function RemindersSection() {
  const {
    loading,
    clientsToRemind,
    fetchConfiguration,
    updateConfiguration,
    fetchClientsToRemind,
    sendReminder,
    triggerAutomaticReminders,
  } = useReminders()

  const [config, setConfig] = useState<ConfigurationRelances | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    mois_sans_activite: 6,
    message_relance: '',
    actif: true,
  })

  useEffect(() => {
    loadConfiguration()
    loadClientsToRemind()
  }, [])

  const loadConfiguration = async () => {
    try {
      const cfg = await fetchConfiguration()
      setConfig(cfg as ConfigurationRelances)
      setFormData({
        mois_sans_activite: cfg.mois_sans_activite,
        message_relance: cfg.message_relance,
        actif: cfg.actif,
      })
    } catch (err) {
      console.error('Failed to load configuration:', err)
    }
  }

  const loadClientsToRemind = async () => {
    await fetchClientsToRemind()
  }

  const handleSaveConfig = async () => {
    const success = await updateConfiguration(
      formData.mois_sans_activite,
      formData.message_relance,
      formData.actif
    )
    if (success) {
      setEditMode(false)
      await loadConfiguration()
    }
  }

  const handleSendReminder = async (clientId: string) => {
    const success = await sendReminder(clientId)
    if (success) {
      await loadClientsToRemind()
    }
  }

  const handleTriggerAutomatic = async () => {
    const result = await triggerAutomaticReminders()
    if (result) {
      await loadClientsToRemind()
    }
  }

  return (
    <div className="card space-y-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
        <span className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
          <Bell size={15} className="text-brand-700" />
        </span>
        Relances automatiques
      </h2>

      {/* Configuration */}
      <div className="border-t border-slate-100 pt-4 space-y-4">
        {!editMode ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">Délai de relance</p>
              <p className="text-sm font-semibold text-slate-700">
                {config?.mois_sans_activite || 6} mois sans activité
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">Message de relance</p>
              <p className="text-sm text-slate-700 line-clamp-2">
                {config?.message_relance}
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50">
              <div className={`w-3 h-3 rounded-full ${config?.actif ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <p className="text-sm font-medium text-slate-700">
                {config?.actif ? 'Relances' : 'Relances'} {config?.actif ? 'activées' : 'désactivées'}
              </p>
            </div>

            <button
              onClick={() => setEditMode(true)}
              className="btn-secondary btn-sm w-full"
            >
              Configurer les relances
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="form-group">
              <label className="label">Après combien de mois sans activité relancer ?</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={formData.mois_sans_activite}
                  onChange={(e) => setFormData(p => ({ ...p, mois_sans_activite: parseInt(e.target.value) || 0 }))}
                  className="input w-20"
                />
                <span className="text-sm text-slate-500">mois</span>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Message de relance</label>
              <textarea
                value={formData.message_relance}
                onChange={(e) => setFormData(p => ({ ...p, message_relance: e.target.value }))}
                placeholder="Entrez le message à envoyer lors de la relance..."
                className="input resize-none"
                rows={3}
              />
            </div>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={formData.actif}
                onChange={(e) => setFormData(p => ({ ...p, actif: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">Relances activées</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="btn-primary btn-sm flex-1"
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Sauvegarde…</> : 'Enregistrer'}
              </button>
              <button onClick={() => setEditMode(false)} className="btn-secondary btn-sm flex-1">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clients à relancer */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            Clients à relancer ({clientsToRemind.length})
          </p>
          {clientsToRemind.length > 0 && (
            <button
              onClick={handleTriggerAutomatic}
              disabled={loading}
              className="btn-primary btn-xs gap-1"
            >
              {loading ? (
                <><Loader2 size={12} className="animate-spin" /></>
              ) : (
                <><Send size={12} /> Relancer tous</>
              )}
            </button>
          )}
        </div>

        {clientsToRemind.length === 0 ? (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-emerald-700">✓</span>
            </div>
            <p className="text-sm text-emerald-700">
              Tous les clients sont à jour ! Aucune relance à envoyer.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {clientsToRemind.map((client) => (
              <div
                key={client.client_id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm">{client.nom_client}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {client.email_client || 'Pas d\'email'}
                    {client.mois_depuis_activite && (
                      <span className="ml-2">• {Math.floor(client.mois_depuis_activite)} mois sans activité</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleSendReminder(client.client_id)}
                  disabled={loading}
                  className="btn-secondary btn-xs whitespace-nowrap ml-2 gap-1"
                >
                  {loading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <><Send size={12} /> Relancer</>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-2">
        <AlertCircle size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Les relances automatiques envoient un email au client. L'historique des relances est conservé pour éviter les doublons.
        </p>
      </div>
    </div>
  )
}
