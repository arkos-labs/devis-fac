import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatEuros } from '@/lib/utils'
import type { Client, IAPrestationItem } from '@/types/database'
import {
  X, Plus, Zap, Loader2, ChevronDown,
  Trash2, Tag, Check
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────
export interface LigneForm {
  description: string; detail: string
  quantite: number; unite: string
  prix_unitaire: number; ordre: number
  is_upsell?: boolean
}

export interface ClientForm {
  nom: string; email: string; telephone: string;
  adresse: string; ville: string; code_postal: string;
}
const INITIAL_CLIENT: ClientForm = { nom: '', email: '', telephone: '', adresse: '', ville: '', code_postal: '' }

export interface DevisFormData {
  client_id: string; date_validite: string
  notes_client: string; notes_internes: string
  genere_par_ia: boolean; prompt_ia: string
}

interface CatItem {
  id: string; nom: string; prix_defaut: number; unite: string
  parent_id: string | null; is_upsell: boolean
}

// Une prestation dans le devis
interface PrestationRow {
  uid: number           // clé locale unique
  catalogueId?: string  // si vient du catalogue
  description: string
  prix: number
  quantite: number
  unite: string
  // options ajoutées (depuis upsells ou libres)
  options: Array<{ description: string; prix: number }>
}

interface Props {
  editingNumero?: string
  onSave: (form: DevisFormData, lignes: LigneForm[]) => void
  onClose: () => void
  isSaving: boolean
}

let UID = 0
const newRow = (partial?: Partial<PrestationRow>): PrestationRow => ({
  uid: ++UID, catalogueId: undefined,
  description: '', prix: 0, quantite: 1, unite: 'forfait', options: [],
  ...partial,
})

export default function DevisModal({ editingNumero, onSave, onClose, isSaving }: Props) {
  const { user } = useAuth()
  const [rows, setRows] = useState<PrestationRow[]>([newRow()])
  const [form, setForm] = useState<DevisFormData>({
    client_id: '', date_validite: '', notes_client: '',
    notes_internes: '', genere_par_ia: false, prompt_ia: ''
  })
  const [showIA, setShowIA] = useState(false)
  const [promptIA, setPromptIA] = useState('')
  const [iaLoading, setIALoading] = useState(false)

  const qc = useQueryClient()
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientForm, setNewClientForm] = useState<ClientForm>(INITIAL_CLIENT)

  const createClient = useMutation({
    mutationFn: async (clientData: ClientForm) => {
      const { data, error } = await supabase.from('clients').insert({
        user_id: user!.id,
        ...clientData
      }).select('id, nom').single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setForm(f => ({ ...f, client_id: data.id }))
      setShowNewClient(false)
      setNewClientForm(INITIAL_CLIENT)
      toast.success('Client créé avec succès')
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  const handleCreateClient = () => {
    if (!newClientForm.nom.trim()) return toast.error('Entrez un nom de client')
    createClient.mutate(newClientForm)
  }

  // ── Data ─────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients').select('id, nom').eq('user_id', user!.id).order('nom')
      if (error) throw error
      return (data ?? []) as Client[]
    },
    enabled: !!user,
  })

  const { data: catalogue = [] } = useQuery<CatItem[]>({
    queryKey: ['catalogue-all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalogue_prestations')
        .select('id, nom, prix_defaut, unite, parent_id, is_upsell')
        .eq('user_id', user!.id).order('ordre')
      if (error) throw error
      return (data ?? []) as CatItem[]
    },
    enabled: !!user,
  })

  const prestationsCatalogue = catalogue.filter(c => !c.is_upsell)
  const upsellsOf = (parentId: string) => catalogue.filter(c => c.is_upsell && c.parent_id === parentId)

  // ── Helpers lignes ────────────────────────────────────────────
  const updateRow = (uid: number, patch: Partial<PrestationRow>) =>
    setRows(rs => rs.map(r => r.uid === uid ? { ...r, ...patch } : r))

  const removeRow = (uid: number) =>
    setRows(rs => rs.filter(r => r.uid !== uid))

  // Sélectionner une prestation depuis le catalogue
  const selectCatalogue = (uid: number, catId: string) => {
    const cat = prestationsCatalogue.find(c => c.id === catId)
    if (!cat) return
    updateRow(uid, {
      catalogueId: catId,
      description: cat.nom,
      prix: cat.prix_defaut,
      unite: cat.unite,
      options: [],
    })
  }

  // Toggle upsell sur une prestation
  const toggleUpsell = (uid: number, upsell: CatItem) => {
    setRows(rs => rs.map(r => {
      if (r.uid !== uid) return r
      const already = r.options.some(o => o.description === upsell.nom)
      return {
        ...r,
        options: already
          ? r.options.filter(o => o.description !== upsell.nom)
          : [...r.options, { description: upsell.nom, prix: upsell.prix_defaut }],
      }
    }))
  }

  // Ajouter une option libre
  const addCustomOption = (uid: number) => {
    setRows(rs => rs.map(r =>
      r.uid === uid ? { ...r, options: [...r.options, { description: '', prix: 0 }] } : r
    ))
  }

  const updateOption = (uid: number, oi: number, key: 'description' | 'prix', val: string | number) =>
    setRows(rs => rs.map(r =>
      r.uid !== uid ? r : {
        ...r,
        options: r.options.map((o, i) => i === oi ? { ...o, [key]: val } : o),
      }
    ))

  const removeOption = (uid: number, oi: number) =>
    setRows(rs => rs.map(r =>
      r.uid !== uid ? r : { ...r, options: r.options.filter((_, i) => i !== oi) }
    ))

  // ── Total ─────────────────────────────────────────────────────
  const total = rows.reduce((s, r) => {
    return s + r.quantite * r.prix + r.options.reduce((os, o) => os + o.prix, 0)
  }, 0)

  // ── Construire les lignes Supabase ────────────────────────────
  const toLignes = (): LigneForm[] => {
    const result: LigneForm[] = []
    let ordre = 0
    rows.forEach(r => {
      result.push({
        description: r.description, detail: '',
        quantite: r.quantite, unite: r.unite,
        prix_unitaire: r.prix, ordre: ordre++,
        is_upsell: false,
      })
      r.options.forEach(o => {
        result.push({
          description: o.description, detail: '',
          quantite: 1, unite: 'forfait',
          prix_unitaire: o.prix, ordre: ordre++,
          is_upsell: true,
        })
      })
    })
    return result
  }

  // ── IA ────────────────────────────────────────────────────────
  const genererIA = async () => {
    if (!promptIA.trim()) return toast.error('Décrivez la prestation')
    setIALoading(true)
    try {
      const key = import.meta.env.VITE_OPENAI_API_KEY as string
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Expert nettoyage France. JSON: {"prestations":[{"description":"...","quantite":1,"unite":"forfait","prix_unitaire":0,"options":[{"description":"...","prix":0}]}],"notes_client":"..."}`
            },
            { role: 'user', content: `Génère un devis pour : "${promptIA}"` }
          ],
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error?.message ?? 'Erreur OpenAI')
      const r = await res.json()
      const parsed = JSON.parse(r.choices[0].message.content)
      setRows(parsed.prestations.map((p: IAPrestationItem & { options?: Array<{ description: string; prix: number }> }) => newRow({
        description: p.description,
        quantite: p.quantite ?? 1,
        unite: p.unite ?? 'forfait',
        prix: p.prix_unitaire ?? 0,
        options: p.options ?? [],
      })))
      setForm(f => ({ ...f, notes_client: parsed.notes_client ?? '', genere_par_ia: true, prompt_ia: promptIA }))
      setShowIA(false)
      toast.success('Devis IA généré')
    } catch (e) {
      toast.error(`Erreur IA : ${(e as Error).message}`)
    } finally {
      setIALoading(false)
    }
  }

  const handleSave = () => {
    if (!form.client_id) return toast.error('Sélectionnez un client')
    if (!rows[0]?.description) return toast.error('Ajoutez au moins une prestation')
    onSave(form, toLignes())
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto animate-slide-up">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">
            {editingNumero ? `Modifier ${editingNumero}` : 'Nouveau devis'}
          </h2>
          <div className="flex items-center gap-2">
            {!editingNumero && (
              <button onClick={() => setShowIA(v => !v)}
                className="btn-sm btn bg-gradient-to-r from-violet-600 to-blue-600 text-white gap-1.5">
                <Zap size={12} /> Auto
              </button>
            )}
            <button onClick={onClose} className="btn-icon btn-ghost"><X size={17} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── IA ──────────────────────────────────────────── */}
          {showIA && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200">
              <p className="text-xs font-bold text-violet-700 mb-2">Décrivez la prestation :</p>
              <div className="flex gap-2">
                <input value={promptIA} onChange={e => setPromptIA(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && genererIA()}
                  placeholder="Ex : canapé 3 places + matelas Paris…"
                  className="input flex-1 text-sm" />
                <button onClick={genererIA} disabled={iaLoading}
                  className="btn-primary btn-sm gap-1.5 whitespace-nowrap">
                  {iaLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  {iaLoading ? '…' : 'Générer'}
                </button>
              </div>
            </div>
          )}

          {/* ── Client + Date ────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0">Client *</label>
                {!showNewClient && (
                  <button type="button" onClick={() => setShowNewClient(true)}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-700">
                    + Nouveau client
                  </button>
                )}
              </div>
              
              {showNewClient ? (
                <div className="p-4 rounded-xl border border-brand-100 bg-brand-50/30 space-y-3 relative">
                  <button onClick={() => setShowNewClient(false)} type="button" className="absolute top-3 right-3 text-slate-400 hover:text-slate-700">
                    <X size={16} />
                  </button>
                  <p className="text-xs font-bold text-brand-700 uppercase tracking-wider mb-2">Nouveau client</p>
                  
                  <div className="form-group">
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Nom complet *</label>
                    <input autoFocus value={newClientForm.nom} onChange={e => setNewClientForm(f => ({ ...f, nom: e.target.value }))}
                           placeholder="Marie Dupont" className="input text-sm py-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Email</label>
                      <input type="email" value={newClientForm.email} onChange={e => setNewClientForm(f => ({ ...f, email: e.target.value }))}
                             placeholder="marie@exemple.fr" className="input text-sm py-2" />
                    </div>
                    <div className="form-group">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Téléphone</label>
                      <input value={newClientForm.telephone} onChange={e => setNewClientForm(f => ({ ...f, telephone: e.target.value }))}
                             placeholder="06 12 34 56 78" className="input text-sm py-2" />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Adresse</label>
                    <input value={newClientForm.adresse} onChange={e => setNewClientForm(f => ({ ...f, adresse: e.target.value }))}
                           placeholder="12 rue de la Paix" className="input text-sm py-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Ville</label>
                      <input value={newClientForm.ville} onChange={e => setNewClientForm(f => ({ ...f, ville: e.target.value }))}
                             placeholder="Paris" className="input text-sm py-2" />
                    </div>
                    <div className="form-group">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Code postal</label>
                      <input value={newClientForm.code_postal} onChange={e => setNewClientForm(f => ({ ...f, code_postal: e.target.value }))}
                             placeholder="75001" className="input text-sm py-2" />
                    </div>
                  </div>

                  <div className="pt-1 text-right">
                    <button onClick={handleCreateClient} disabled={createClient.isPending} type="button" className="btn-primary btn-sm px-4">
                      {createClient.isPending ? 'Création…' : 'Créer le client'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <select required value={form.client_id}
                    onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                    className="input appearance-none pr-8">
                    <option value="">Sélectionner…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="label">Validité</label>
              <input type="date" className="input" value={form.date_validite}
                onChange={e => setForm(f => ({ ...f, date_validite: e.target.value }))} />
            </div>
          </div>

          {/* ── Liste des prestations ────────────────────────── */}
          <div className="space-y-3">
            <label className="label">Prestations *</label>

            {rows.map((row) => {
              const upsells = row.catalogueId ? upsellsOf(row.catalogueId) : []

              return (
                <div key={row.uid} className="rounded-2xl border border-slate-200 overflow-hidden">

                  {/* ─ Ligne principale ─ */}
                  <div className="flex items-center gap-2 p-3">
                    {/* Sélecteur catalogue OU saisie libre */}
                    {prestationsCatalogue.length > 0 && !row.catalogueId ? (
                      <div className="flex-1 relative">
                        <select
                          className="input appearance-none pr-8 text-sm"
                          value=""
                          onChange={e => {
                            if (e.target.value === '__libre') {
                              updateRow(row.uid, { catalogueId: undefined, description: '' })
                            } else {
                              selectCatalogue(row.uid, e.target.value)
                            }
                          }}
                        >
                          <option value="">Choisir une prestation…</option>
                          {prestationsCatalogue.map(c => (
                            <option key={c.id} value={c.id}>{c.nom}</option>
                          ))}
                          <option value="__libre">✏️ Saisie libre</option>
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    ) : (
                      <input
                        placeholder="Prestation (ex : Canapé 3 places)"
                        value={row.description}
                        onChange={e => updateRow(row.uid, { description: e.target.value })}
                        className="input flex-1 text-sm font-medium"
                        autoFocus={!row.catalogueId}
                      />
                    )}

                    <input
                      type="number" min="0" step="0.01"
                      value={row.prix || ''}
                      onChange={e => updateRow(row.uid, { prix: +e.target.value })}
                      placeholder="€"
                      className="input w-20 text-sm text-right font-bold"
                    />

                    <button
                      onClick={() => rows.length > 1 ? removeRow(row.uid) : undefined}
                      disabled={rows.length === 1}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* ─ Upsells de cette prestation ─ */}
                  {(upsells.length > 0 || row.options.length > 0) && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2.5 space-y-2">

                      {/* Upsells catalogue à cocher */}
                      {upsells.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                            Options disponibles
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {upsells.map(u => {
                              const isOn = row.options.some(o => o.description === u.nom)
                              return (
                                <button
                                  key={u.id}
                                  onClick={() => toggleUpsell(row.uid, u)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                    isOn
                                      ? 'bg-violet-600 text-white border-violet-600'
                                      : 'bg-white text-violet-700 border-violet-200 hover:border-violet-400'
                                  }`}
                                >
                                  {isOn ? <Check size={10} /> : <Tag size={10} />}
                                  {u.nom}
                                  {u.prix_defaut > 0 && (
                                    <span className={isOn ? 'text-violet-200' : 'text-violet-400'}>
                                      +{u.prix_defaut}€
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Options libres ajoutées */}
                      {row.options.filter(o =>
                        !upsells.some(u => u.nom === o.description)
                      ).map((o, oi) => {
                        const realIdx = row.options.indexOf(o)
                        return (
                          <div key={oi} className="flex items-center gap-2">
                            <Tag size={10} className="text-violet-400 flex-shrink-0" />
                            <input
                              value={o.description}
                              onChange={e => updateOption(row.uid, realIdx, 'description', e.target.value)}
                              placeholder="Option personnalisée"
                              className="input flex-1 text-xs py-1.5"
                            />
                            <input
                              type="number" value={o.prix}
                              onChange={e => updateOption(row.uid, realIdx, 'prix', +e.target.value)}
                              placeholder="€"
                              className="input w-16 text-xs py-1.5 text-right"
                            />
                            <button onClick={() => removeOption(row.uid, realIdx)}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* ─ Bouton + option libre ─ */}
                  <div className={`border-t border-slate-100 px-3 py-1.5 ${upsells.length > 0 || row.options.length > 0 ? '' : 'bg-white'}`}>
                    <button
                      onClick={() => addCustomOption(row.uid)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-violet-600 transition-colors"
                    >
                      <Plus size={11} /> Ajouter une option libre
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Bouton nouvelle prestation */}
            <button
              onClick={() => setRows(rs => [...rs, newRow()])}
              className="btn-secondary btn-sm w-full gap-1.5"
            >
              <Plus size={13} /> Ajouter une prestation
            </button>
          </div>

          {/* ── Total ───────────────────────────────────────── */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-brand-50 border border-brand-100">
              <span className="text-sm font-bold text-brand-800">Total HT</span>
              <span className="text-lg font-extrabold text-brand-800">{formatEuros(total)}</span>
            </div>
          )}

          {/* ── Notes ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Notes client (PDF)</label>
              <textarea className="input resize-none text-sm" rows={2}
                value={form.notes_client}
                onChange={e => setForm(f => ({ ...f, notes_client: e.target.value }))}
                placeholder="Conditions, remarques…" />
            </div>
            <div className="form-group">
              <label className="label">Notes internes</label>
              <textarea className="input resize-none text-sm" rows={2}
                value={form.notes_internes}
                onChange={e => setForm(f => ({ ...f, notes_internes: e.target.value }))}
                placeholder="Non visible sur le PDF" />
            </div>
          </div>

          {/* ── Actions ─────────────────────────────────────── */}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button onClick={handleSave} disabled={isSaving} className="btn-primary flex-1 gap-1.5">
              {isSaving
                ? <><Loader2 size={13} className="animate-spin" /> Enregistrement…</>
                : editingNumero
                  ? 'Mettre à jour'
                  : `Créer${total > 0 ? ' — ' + formatEuros(total) : ''}`
              }
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center">TVA non applicable — Art. 293 B du CGI</p>
        </div>
      </div>
    </div>
  )
}
