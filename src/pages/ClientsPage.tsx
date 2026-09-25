import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getInitiales } from '@/lib/utils'
import type { Client } from '@/types/database'
import { Plus, Search, Phone, Mail, MapPin, X, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { DEMO_CLIENTS } from '@/lib/mockData'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

// ── Formulaire client ─────────────────────────────────────────
interface ClientForm {
  nom: string; email: string; telephone: string
  adresse: string; ville: string; code_postal: string; notes: string
}

const FORM_VIDE: ClientForm = {
  nom: '', email: '', telephone: '',
  adresse: '', ville: '', code_postal: '', notes: ''
}

export default function ClientsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientForm>(FORM_VIDE)

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
    mutationFn: async (f: ClientForm) => {
      if (editingClient) {
        const { error } = await supabase.from('clients').update({
          ...f, dernier_contact: new Date().toISOString()
        }).eq('id', editingClient.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('clients').insert({
          ...f, user_id: user!.id
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success(editingClient ? 'Client mis à jour !' : 'Client ajouté !')
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
  const openNew = () => { setEditingClient(null); setForm(FORM_VIDE); setShowModal(true) }
  const openEdit = (c: Client) => {
    setEditingClient(c)
    setForm({ nom: c.nom, email: c.email ?? '', telephone: c.telephone ?? '',
      adresse: c.adresse ?? '', ville: c.ville ?? '', code_postal: c.code_postal ?? '', notes: c.notes ?? '' })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditingClient(null); setForm(FORM_VIDE) }

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
              <div key={c.id} className="flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 hover:bg-slate-50/70 transition-colors group">
                {/* Avatar */}
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl ${AVATAR_COLORS[i % AVATAR_COLORS.length]}
                  flex items-center justify-center text-white font-bold text-[10px] md:text-xs flex-shrink-0`}>
                  {getInitiales(c.nom)}
                </div>

                {/* Info principale */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-bold text-slate-800 truncate">{c.nom}</p>
                  <div className="flex items-center gap-1.5 md:gap-3 mt-0.5 text-[10px] md:text-xs">
                    {c.telephone && (
                      <span className="flex items-center gap-0.5 text-slate-400 truncate">
                        <Phone size={9} className="md:w-[10px]" /> <span className="hidden sm:inline">{c.telephone}</span>
                      </span>
                    )}
                    {c.ville && (
                      <span className="flex items-center gap-0.5 text-slate-400 truncate">
                        <MapPin size={9} className="md:w-[10px]" /> {c.ville}
                      </span>
                    )}
                    {c.email && (
                      <span className="hidden md:flex items-center gap-0.5 text-slate-400 truncate">
                        <Mail size={9} /> {c.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 md:gap-1.5 opacity-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => navigate(`/clients/${c.id}`)}
                    className="btn-sm btn-secondary text-[10px] md:text-xs px-2">
                    Fiche
                  </button>
                  <button onClick={() => openEdit(c)}
                    className="btn-sm btn-primary text-[10px] md:text-xs px-2">
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
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
              className="p-6 space-y-4"
            >
              <div className="form-group">
                <label className="label">Nom complet *</label>
                <input required className="input" placeholder="Marie Dupont"
                  value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Email</label>
                  <input type="email" className="input" placeholder="marie@exemple.fr"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">Téléphone</label>
                  <input className="input" placeholder="06 12 34 56 78"
                    value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Adresse</label>
                <input className="input" placeholder="12 rue de la Paix"
                  value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Ville</label>
                  <input className="input" placeholder="Paris"
                    value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">Code postal</label>
                  <input className="input" placeholder="75001"
                    value={form.code_postal} onChange={e => setForm(f => ({ ...f, code_postal: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Notes internes</label>
                <textarea className="input resize-none" rows={3} placeholder="Remarques, préférences…"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={upsertClient.isPending} className="btn-primary flex-1">
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
