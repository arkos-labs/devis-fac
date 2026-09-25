import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getInitiales } from '@/lib/utils'
import { getClientDisplayName, getClientTypeLabel } from '@/lib/clientHelpers'
import { validateClientForm, resetFormByType, getClientTypeHelpMessage, type ClientFormData, type ValidationError } from '@/lib/clientValidation'
import type { Client, ClientType } from '@/types/database'
import { Plus, Search, Phone, Mail, MapPin, X, User, Building2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { DEMO_CLIENTS } from '@/lib/mockData'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

export default function ClientsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState<Partial<ClientFormData>>({
    type: 'professionnel',
    email: '', telephone: '', adresse: '', ville: '', code_postal: '', notes: '', country: 'France',
    company_name: '', siren: '', siret: '', vat_number: '', legal_form: '', contact_name: '', service_address: '',
    first_name: '', last_name: '', civility: '', is_canvassing: false
  })
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  // ── Requête ─────────────────────────────────────────────────
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_CLIENTS
      const { data, error } = await supabase
        .from('clients').select('*').eq('user_id', user!.id).order('nom')
      if (error) throw error
      return (data ?? []) as Client[]
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_CLIENTS : undefined,
  })

  // ── Mutations ────────────────────────────────────────────────
  const upsertClient = useMutation({
    mutationFn: async (f: Partial<ClientFormData>) => {
      const errors = validateClientForm(f)
      if (errors.length > 0) {
        setValidationErrors(errors)
        throw new Error(`Validation échouée : ${errors.map(e => e.message).join(', ')}`)
      }

      const payload: Record<string, any> = {
        type: f.type,
        email: f.email || null,
        telephone: f.telephone || null,
        adresse: f.adresse,
        ville: f.ville,
        code_postal: f.code_postal,
        notes: f.notes || null,
        country: f.country || 'France'
      }

      if (f.type === 'professionnel') {
        payload.company_name = f.company_name
        payload.siren = f.siren
        payload.siret = f.siret || null
        payload.vat_number = f.vat_number || null
        payload.legal_form = f.legal_form || null
        payload.contact_name = f.contact_name || null
        payload.service_address = f.service_address || null
        payload.first_name = null
        payload.last_name = null
        payload.civility = null
        payload.is_canvassing = false
        payload.nom = f.company_name
      } else {
        payload.first_name = f.first_name
        payload.last_name = f.last_name
        payload.civility = f.civility || null
        payload.is_canvassing = f.is_canvassing || false
        payload.company_name = null
        payload.siren = null
        payload.siret = null
        payload.vat_number = null
        payload.legal_form = null
        payload.contact_name = null
        payload.service_address = null
        payload.nom = `${f.first_name} ${f.last_name}`
      }

      if (editingClient) {
        const { error } = await supabase.from('clients').update({
          ...payload, dernier_contact: new Date().toISOString()
        }).eq('id', editingClient.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('clients').insert({
          ...payload, user_id: user!.id
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success(editingClient ? 'Client mis à jour !' : 'Client ajouté !')
      setValidationErrors([])
      closeModal()
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client supprimé')
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // ── Helpers ──────────────────────────────────────────────────
  const openNew = () => {
    setEditingClient(null)
    const newForm = resetFormByType('professionnel') as Partial<ClientFormData>
    setForm(newForm)
    setValidationErrors([])
    setShowModal(true)
  }

  const openEdit = (c: Client) => {
    setEditingClient(c)
    const newForm: Partial<ClientFormData> = {
      type: c.type,
      email: c.email ?? '',
      telephone: c.telephone ?? '',
      adresse: c.adresse ?? '',
      ville: c.ville ?? '',
      code_postal: c.code_postal ?? '',
      notes: c.notes ?? '',
      country: c.country ?? 'France',
      company_name: c.company_name ?? '',
      siren: c.siren ?? '',
      siret: c.siret ?? '',
      vat_number: c.vat_number ?? '',
      legal_form: c.legal_form ?? '',
      contact_name: c.contact_name ?? '',
      service_address: c.service_address ?? '',
      first_name: c.first_name ?? '',
      last_name: c.last_name ?? '',
      civility: c.civility ?? '',
      is_canvassing: c.is_canvassing ?? false
    }
    setForm(newForm)
    setValidationErrors([])
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingClient(null)
    const resetForm = resetFormByType('professionnel') as Partial<ClientFormData>
    setForm(resetForm)
    setValidationErrors([])
  }

  const handleTypeChange = (type: ClientType) => {
    const newForm = resetFormByType(type)
    setForm(newForm as Partial<ClientFormData>)
    setValidationErrors([])
  }

  const getError = (field: keyof ClientFormData): ValidationError | undefined =>
    validationErrors.find(e => e.field === field)

  const filtered = clients.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.telephone ?? '').includes(search)
  )

  const AVATAR_COLORS = [
    'bg-brand-700', 'bg-violet-600', 'bg-emerald-600',
    'bg-amber-500', 'bg-pink-600', 'bg-teal-600'
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Clients</h1>
          <p className="text-sm text-slate-500">{clients.length} client{clients.length > 1 ? 's' : ''} au total</p>
        </div>
        <button id="add-client-btn" onClick={openNew} className="btn-primary">
          <Plus size={16} /> Ajouter un client
        </button>
      </div>

      {/* ── Recherche ──────────────────────────────────────── */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par nom, email, téléphone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* ── Liste ──────────────────────────────────────────── */}
      {isLoading ? (
        <div className="card p-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-200 rounded w-32" />
                <div className="h-2.5 bg-slate-100 rounded w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <User size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="font-semibold text-slate-500">Aucun client trouvé</p>
          <p className="text-sm text-slate-400 mt-1">
            {search ? 'Essayez un autre terme de recherche.' : 'Ajoutez votre premier client.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="divide-y divide-slate-50">
            {filtered.map((c, i) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 hover:bg-slate-50/70 transition-colors group">
                {/* Avatar + Nom + Type */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl ${AVATAR_COLORS[i % AVATAR_COLORS.length]}
                    flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                    {c.type === 'professionnel' ? <Building2 size={16} /> : getInitiales(getClientDisplayName(c))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base font-bold text-slate-800 truncate">{getClientDisplayName(c)}</p>
                    <p className="text-xs text-slate-400">{getClientTypeLabel(c.type)}</p>
                  </div>
                </div>

                {/* Info secondaires */}
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  {c.telephone && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Phone size={14} /> {c.telephone}
                    </span>
                  )}
                  {c.ville && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin size={14} /> {c.ville}
                    </span>
                  )}
                  {c.email && (
                    <span className="hidden md:flex items-center gap-1 text-slate-400">
                      <Mail size={14} /> {c.email}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => navigate(`/clients/${c.id}`)}
                    className="btn-sm btn-secondary text-xs px-2.5">
                    Fiche
                  </button>
                  <button onClick={() => openEdit(c)}
                    className="btn-sm btn-primary text-xs px-2.5">
                    Éditer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal ajout/édition ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                {editingClient ? 'Modifier le client' : 'Nouveau client'}
              </h2>
              <button onClick={closeModal} className="btn-icon btn-ghost">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={e => { e.preventDefault(); upsertClient.mutate(form) }}
              className="p-6 space-y-6"
            >
              {/* ──── SÉLECTEUR DE TYPE ──────────────────────────────── */}
              {!editingClient && (
                <div className="space-y-2">
                  <label className="label">Type de client *</label>
                  <p className="text-xs text-slate-500">{getClientTypeHelpMessage(form.type as ClientType)}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('professionnel')}
                      className={`p-4 rounded-lg border-2 transition ${
                        form.type === 'professionnel'
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">🏢</div>
                      <div className="font-semibold text-slate-800">Professionnel</div>
                      <div className="text-xs text-slate-500 mt-1">SARL, SAS, auto-entrepreneur…</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('particulier')}
                      className={`p-4 rounded-lg border-2 transition ${
                        form.type === 'particulier'
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">👤</div>
                      <div className="font-semibold text-slate-800">Particulier</div>
                      <div className="text-xs text-slate-500 mt-1">Client individuel</div>
                    </button>
                  </div>
                </div>
              )}

              {/* ──── AFFICHAGE ERREURS GLOBALES ──────────────────────── */}
              {validationErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">
                    <p className="font-semibold">Veuillez corriger les erreurs :</p>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      {validationErrors.slice(0, 5).map((e, i) => (
                        <li key={i} className="text-xs">{e.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* ──── CHAMPS SPÉCIFIQUES PROFESSIONNEL ──────────────────── */}
              {form.type === 'professionnel' && (
                <>
                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-slate-800 text-sm">Informations entreprise</h3>

                    <div className="form-group">
                      <label className="label">Dénomination sociale *</label>
                      <input
                        className={`input ${getError('company_name') ? 'border-red-300' : ''}`}
                        placeholder="Ma Boite SARL"
                        value={form.company_name || ''}
                        onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                      {getError('company_name') && <p className="text-xs text-red-600 mt-1">{getError('company_name')!.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="label">SIREN * <span className="text-xs text-slate-400">(9 chiffres)</span></label>
                        <input
                          className={`input font-mono ${getError('siren') ? 'border-red-300' : ''}`}
                          placeholder="81220670"
                          maxLength={9}
                          value={form.siren || ''}
                          onChange={e => setForm(f => ({ ...f, siren: e.target.value.replace(/\D/g, '').slice(0, 9) }))} />
                        {getError('siren') && <p className="text-xs text-red-600 mt-1">{getError('siren')!.message}</p>}
                      </div>
                      <div className="form-group">
                        <label className="label">SIRET <span className="text-xs text-slate-400">(14 chiffres, optionnel)</span></label>
                        <input
                          className={`input font-mono ${getError('siret') ? 'border-red-300' : ''}`}
                          placeholder="81220670012345"
                          maxLength={14}
                          value={form.siret || ''}
                          onChange={e => setForm(f => ({ ...f, siret: e.target.value.replace(/\D/g, '').slice(0, 14) }))} />
                        {getError('siret') && <p className="text-xs text-red-600 mt-1">{getError('siret')!.message}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="label">N° TVA <span className="text-xs text-slate-400">(optionnel)</span></label>
                        <input
                          className={`input font-mono ${getError('vat_number') ? 'border-red-300' : ''}`}
                          placeholder="FR12345678901"
                          value={form.vat_number || ''}
                          onChange={e => setForm(f => ({ ...f, vat_number: e.target.value.toUpperCase() }))} />
                        {getError('vat_number') && <p className="text-xs text-red-600 mt-1">{getError('vat_number')!.message}</p>}
                      </div>
                      <div className="form-group">
                        <label className="label">Forme juridique <span className="text-xs text-slate-400">(optionnel)</span></label>
                        <input
                          className="input"
                          placeholder="SARL, SAS, SASU…"
                          value={form.legal_form || ''}
                          onChange={e => setForm(f => ({ ...f, legal_form: e.target.value }))} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="label">Nom du contact <span className="text-xs text-slate-400">(optionnel)</span></label>
                      <input
                        className="input"
                        placeholder="Jean Dupont"
                        value={form.contact_name || ''}
                        onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                    </div>

                    <div className="form-group">
                      <label className="label">Adresse de livraison <span className="text-xs text-slate-400">(optionnel)</span></label>
                      <input
                        className="input"
                        placeholder="12 rue différente (si applicable)"
                        value={form.service_address || ''}
                        onChange={e => setForm(f => ({ ...f, service_address: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {/* ──── CHAMPS SPÉCIFIQUES PARTICULIER ──────────────────── */}
              {form.type === 'particulier' && (
                <>
                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-slate-800 text-sm">Informations personnelles</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="form-group">
                        <label className="label">Civilité <span className="text-xs text-slate-400">(optionnel)</span></label>
                        <select
                          className="input"
                          value={form.civility || ''}
                          onChange={e => setForm(f => ({ ...f, civility: e.target.value as any }))} >
                          <option value="">— Aucune —</option>
                          <option value="M.">M.</option>
                          <option value="Mme">Mme</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="label">Prénom *</label>
                        <input
                          className={`input ${getError('first_name') ? 'border-red-300' : ''}`}
                          placeholder="Jean"
                          value={form.first_name || ''}
                          onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                        {getError('first_name') && <p className="text-xs text-red-600 mt-1">{getError('first_name')!.message}</p>}
                      </div>
                      <div className="form-group">
                        <label className="label">Nom *</label>
                        <input
                          className={`input ${getError('last_name') ? 'border-red-300' : ''}`}
                          placeholder="Dupont"
                          value={form.last_name || ''}
                          onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                        {getError('last_name') && <p className="text-xs text-red-600 mt-1">{getError('last_name')!.message}</p>}
                      </div>
                    </div>

                    <div className="form-group flex items-center gap-3 pt-2">
                      <input
                        type="checkbox"
                        id="is_canvassing"
                        className="w-4 h-4 rounded border-slate-300"
                        checked={form.is_canvassing || false}
                        onChange={e => setForm(f => ({ ...f, is_canvassing: e.target.checked }))} />
                      <label htmlFor="is_canvassing" className="text-sm text-slate-700 cursor-pointer">
                        <span className="font-medium">Cas de démarchage à domicile</span>
                        <p className="text-xs text-slate-500 mt-0.5">Si coché → droit de rétractation 14j sur les devis/factures</p>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* ──── CHAMPS COMMUNS ────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800 text-sm">Adresse et contact</h3>

                <div className="form-group">
                  <label className="label">Adresse *</label>
                  <input
                    className={`input ${getError('adresse') ? 'border-red-300' : ''}`}
                    placeholder="12 rue de la Paix"
                    value={form.adresse || ''}
                    onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
                  {getError('adresse') && <p className="text-xs text-red-600 mt-1">{getError('adresse')!.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Code postal *</label>
                    <input
                      className={`input font-mono ${getError('code_postal') ? 'border-red-300' : ''}`}
                      placeholder="75001"
                      maxLength={5}
                      value={form.code_postal || ''}
                      onChange={e => setForm(f => ({ ...f, code_postal: e.target.value }))} />
                    {getError('code_postal') && <p className="text-xs text-red-600 mt-1">{getError('code_postal')!.message}</p>}
                  </div>
                  <div className="form-group">
                    <label className="label">Ville *</label>
                    <input
                      className={`input ${getError('ville') ? 'border-red-300' : ''}`}
                      placeholder="Paris"
                      value={form.ville || ''}
                      onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} />
                    {getError('ville') && <p className="text-xs text-red-600 mt-1">{getError('ville')!.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Email</label>
                    <input
                      type="email"
                      className={`input ${getError('email') ? 'border-red-300' : ''}`}
                      placeholder="contact@exemple.fr"
                      value={form.email || ''}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    {getError('email') && <p className="text-xs text-red-600 mt-1">{getError('email')!.message}</p>}
                  </div>
                  <div className="form-group">
                    <label className="label">Téléphone</label>
                    <input
                      className="input"
                      placeholder="06 12 34 56 78"
                      value={form.telephone || ''}
                      onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Notes internes</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    placeholder="Remarques, préférences…"
                    value={form.notes || ''}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {/* ──── BOUTONS ─────────────────────────────────────── */}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={upsertClient.isPending || (form.type === 'professionnel' && !form.company_name) || (form.type === 'particulier' && !form.first_name)} className="btn-primary flex-1">
                  {upsertClient.isPending ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement…</>
                  ) : editingClient ? 'Mettre à jour' : 'Ajouter le client'}
                </button>
              </div>

              {editingClient && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Supprimer ce client ? Cette action est irréversible.')) {
                      deleteClient.mutate(editingClient.id)
                      closeModal()
                    }
                  }}
                  className="btn-danger btn-sm w-full mt-2"
                >
                  Supprimer le client
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
