import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ParametresCompte } from '@/types/database'
import { Save, Building2, Star, FileText, Upload, Loader2, Plus, Trash2, Tag, ShoppingBag, X, Check, ChevronDown, ChevronRight, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { DEMO_PARAMETRES } from '@/lib/mockData'
import { RemindersSection } from '@/components/RemindersSection'
import { formatStars } from '@/lib/utils'

// ── Types catalogue ───────────────────────────────────────────
interface CatItem {
  id: string
  nom: string
  prix_defaut: number
  unite: string
  parent_id: string | null
  is_upsell: boolean
}

// ── Section Catalogue de prestations ─────────────────────────
function CatalogueSection() {
  const { user } = useAuth()
  const qc = useQueryClient()

  // Toutes les lignes du catalogue (prestations + upsells)
  const { data: items = [], isLoading } = useQuery<CatItem[]>({
    queryKey: ['catalogue-all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalogue_prestations')
        .select('id, nom, prix_defaut, unite, parent_id, is_upsell')
        .eq('user_id', user!.id)
        .order('ordre')
      if (error) throw error
      return (data ?? []) as CatItem[]
    },
    enabled: !!user,
  })

  // Prestations principales
  const prestations = items.filter(i => !i.is_upsell)
  // Upsells par parent_id
  const upsellsOf = (parentId: string) => items.filter(i => i.is_upsell && i.parent_id === parentId)

  // États d'édition inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNom, setEditNom] = useState('')
  const [editPrix, setEditPrix] = useState(0)
  const [editUnite, setEditUnite] = useState('forfait')

  // Nouvelle prestation
  const [newNom, setNewNom] = useState('')
  const [newPrix, setNewPrix] = useState(0)
  const [newUnite, setNewUnite] = useState('forfait')
  const [showNewForm, setShowNewForm] = useState(false)

  // Nouvel upsell par prestation
  const [addingUpsellFor, setAddingUpsellFor] = useState<string | null>(null)
  const [upsellNom, setUpsellNom] = useState('')
  const [upsellPrix, setUpsellPrix] = useState(0)

  // Collapse state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const addPrestation = useMutation({
    mutationFn: async () => {
      if (!newNom.trim()) throw new Error('Nom requis')
      const { error } = await supabase.from('catalogue_prestations').insert({
        user_id: user!.id,
        nom: newNom.trim(),
        prix_defaut: newPrix,
        unite: newUnite,
        categorie: 'custom',
        is_upsell: false,
        ordre: prestations.length * 10,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogue-all'] })
      qc.invalidateQueries({ queryKey: ['catalogue'] })
      setNewNom(''); setNewPrix(0); setNewUnite('forfait'); setShowNewForm(false)
      toast.success('Prestation ajoutée')
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const addUpsell = useMutation({
    mutationFn: async (parentId: string) => {
      if (!upsellNom.trim()) throw new Error('Nom requis')
      const { error } = await supabase.from('catalogue_prestations').insert({
        user_id: user!.id,
        nom: upsellNom.trim(),
        prix_defaut: upsellPrix,
        unite: 'forfait',
        categorie: 'upsell',
        is_upsell: true,
        parent_id: parentId,
        ordre: 100,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogue-all'] })
      qc.invalidateQueries({ queryKey: ['catalogue-upsells'] })
      setUpsellNom(''); setUpsellPrix(0); setAddingUpsellFor(null)
      toast.success('Option ajoutée')
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const updateItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('catalogue_prestations').update({
        nom: editNom.trim(),
        prix_defaut: editPrix,
        unite: editUnite,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogue-all'] })
      setEditingId(null)
      toast.success('Modifié')
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('catalogue_prestations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogue-all'] })
      qc.invalidateQueries({ queryKey: ['catalogue'] })
      qc.invalidateQueries({ queryKey: ['catalogue-upsells'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const startEdit = (item: CatItem) => {
    setEditingId(item.id)
    setEditNom(item.nom)
    setEditPrix(item.prix_defaut)
    setEditUnite(item.unite)
  }

  if (isLoading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
      <Loader2 size={14} className="animate-spin" /> Chargement…
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Liste des prestations */}
      {prestations.length === 0 && !showNewForm && (
        <div className="text-center py-8 text-slate-400">
          <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Aucune prestation dans votre catalogue</p>
          <p className="text-xs mt-1">Ajoutez vos prestations types pour les réutiliser dans vos devis</p>
        </div>
      )}

      {prestations.map(p => {
        const upsells = upsellsOf(p.id)
        const isCollapsed = collapsed[p.id]
        const isEditing = editingId === p.id

        return (
          <div key={p.id} className="rounded-2xl border border-slate-200 overflow-hidden">
            {/* Ligne prestation */}
            <div className="flex items-center gap-2 p-3 bg-white">
              <button
                onClick={() => setCollapsed(c => ({ ...c, [p.id]: !c[p.id] }))}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>

              {isEditing ? (
                <>
                  <input value={editNom} onChange={e => setEditNom(e.target.value)}
                    className="input flex-1 text-sm font-medium" placeholder="Nom de la prestation" autoFocus />
                  <input type="number" value={editPrix} onChange={e => setEditPrix(+e.target.value)}
                    className="input w-20 text-sm text-right" placeholder="€" />
                  <input value={editUnite} onChange={e => setEditUnite(e.target.value)}
                    className="input w-20 text-sm" placeholder="forfait" />
                  <button onClick={() => updateItem.mutate(p.id)} disabled={updateItem.isPending}
                    className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(p)}>
                    <p className="text-sm font-bold text-slate-800">{p.nom}</p>
                    <p className="text-xs text-slate-400">
                      {p.prix_defaut > 0 ? `${p.prix_defaut} € / ${p.unite}` : 'Prix libre'}
                      {upsells.length > 0 && ` · ${upsells.length} option${upsells.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer "${p.nom}" et toutes ses options ?`)) deleteItem.mutate(p.id)
                    }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Upsells + bouton ajouter */}
            {!isCollapsed && (
              <div className="border-t border-slate-100 bg-slate-50/50">
                {upsells.map(u => (
                  <div key={u.id} className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 last:border-0">
                    <Tag size={11} className="text-violet-400 flex-shrink-0" />
                    {editingId === u.id ? (
                      <>
                        <input value={editNom} onChange={e => setEditNom(e.target.value)}
                          className="input flex-1 text-xs py-1.5" autoFocus />
                        <input type="number" value={editPrix} onChange={e => setEditPrix(+e.target.value)}
                          className="input w-16 text-xs py-1.5 text-right" />
                        <button onClick={() => updateItem.mutate(u.id)} disabled={updateItem.isPending}
                          className="p-1 rounded bg-emerald-100 text-emerald-700">
                          <Check size={12} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded text-slate-400">
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-xs text-slate-600 cursor-pointer hover:text-slate-800"
                          onClick={() => startEdit(u)}>
                          {u.nom}
                        </span>
                        <span className="text-xs font-semibold text-violet-600 mr-2">
                          {u.prix_defaut > 0 ? `+${u.prix_defaut} €` : 'Prix libre'}
                        </span>
                        <button onClick={() => deleteItem.mutate(u.id)}
                          className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {/* Formulaire nouvel upsell */}
                {addingUpsellFor === p.id ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50/60">
                    <Tag size={11} className="text-violet-400 flex-shrink-0" />
                    <input
                      value={upsellNom} onChange={e => setUpsellNom(e.target.value)}
                      placeholder="Nom de l'option (ex : Protection imperméabilisante)"
                      className="input flex-1 text-xs py-1.5" autoFocus
                      onKeyDown={e => e.key === 'Enter' && addUpsell.mutate(p.id)}
                    />
                    <input
                      type="number" value={upsellPrix} onChange={e => setUpsellPrix(+e.target.value)}
                      placeholder="€" className="input w-16 text-xs py-1.5 text-right"
                    />
                    <button onClick={() => addUpsell.mutate(p.id)} disabled={addUpsell.isPending}
                      className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                      <Check size={12} />
                    </button>
                    <button onClick={() => { setAddingUpsellFor(null); setUpsellNom(''); setUpsellPrix(0) }}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingUpsellFor(p.id); setUpsellNom(''); setUpsellPrix(0) }}
                    className="flex items-center gap-1.5 px-4 py-2.5 w-full text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
                  >
                    <Plus size={12} /> Ajouter une option / upsell
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Formulaire nouvelle prestation */}
      {showNewForm ? (
        <div className="rounded-2xl border-2 border-dashed border-brand-300 p-3 bg-brand-50/30">
          <p className="text-xs font-bold text-brand-700 mb-2">Nouvelle prestation</p>
          <div className="flex items-center gap-2">
            <input value={newNom} onChange={e => setNewNom(e.target.value)}
              placeholder="Nom de la prestation (ex : Canapé 3 places)"
              className="input flex-1 text-sm" autoFocus
              onKeyDown={e => e.key === 'Enter' && addPrestation.mutate()} />
            <input type="number" value={newPrix} onChange={e => setNewPrix(+e.target.value)}
              placeholder="€" className="input w-20 text-sm text-right" />
            <select value={newUnite} onChange={e => setNewUnite(e.target.value)}
              className="input w-24 text-sm">
              <option value="forfait">forfait</option>
              <option value="m2">m²</option>
              <option value="heure">heure</option>
              <option value="piece">pièce</option>
            </select>
            <button onClick={() => addPrestation.mutate()} disabled={addPrestation.isPending}
              className="p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors">
              <Check size={15} />
            </button>
            <button onClick={() => { setShowNewForm(false); setNewNom(''); setNewPrix(0) }}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="btn-secondary btn-sm w-full gap-1.5"
        >
          <Plus size={13} /> Nouvelle prestation
        </button>
      )}
    </div>
  )
}

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

type FormState = Omit<ParametresCompte,
  'id' | 'user_id' | 'prochain_num_devis' | 'prochain_num_facture' | 'created_at' | 'updated_at'>

export default function ParametresPage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: params, isLoading } = useQuery<ParametresCompte>({
    queryKey: ['parametres', user?.id],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_PARAMETRES
      const { data, error } = await supabase
        .from('parametres_compte').select('*').eq('user_id', user!.id).single()
      if (error) throw error
      return data as ParametresCompte
    },
    enabled: !!user,
    initialData: IS_DEMO ? DEMO_PARAMETRES : undefined,
  })

  const [form, setForm] = useState<Partial<FormState>>({})

  useEffect(() => {
    if (params) {
      setForm({
        nom_entreprise: params.nom_entreprise,
        siret: params.siret,
        adresse_entreprise: params.adresse_entreprise ?? '',
        telephone_entreprise: params.telephone_entreprise ?? '',
        email_entreprise: params.email_entreprise ?? '',
        logo_url: params.logo_url ?? '',
        signature_url: params.signature_url ?? '',
        mentions_legales: params.mentions_legales,
        avis_google_url: params.avis_google_url ?? '',
        note_google: params.note_google,
        nombre_avis_google: params.nombre_avis_google,
        forme_juridique: params.forme_juridique ?? '',
        tva_intracommunautaire: params.tva_intracommunautaire ?? '',
        assujetti_tva: params.assujetti_tva ?? false,
        taux_tva: params.taux_tva ?? 0,
        iban: params.iban ?? '',
        bic: params.bic ?? '',
        code_pays: params.code_pays ?? 'FR',
      })
    }
  }, [params])

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSig, setUploadingSig] = useState(false)

  const uploadFile = async (file: File, bucket: string, field: 'logo_url' | 'signature_url', setLoading: (v: boolean) => void) => {
    setLoading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user!.id}/${field}.${ext}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      setForm(p => ({ ...p, [field]: data.publicUrl + '?t=' + Date.now() }))
      toast.success('Image chargée !')
    } catch (e) {
      toast.error(`Upload échoué : ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('parametres_compte')
        .update(form)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parametres'] })
      toast.success('Paramètres sauvegardés !')
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  const f = (key: keyof FormState) => ({
    value: (form[key] ?? '') as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Paramètres du compte</h1>
          <p className="text-sm text-slate-500">Ces informations apparaîtront sur vos devis et factures PDF</p>
        </div>
        <button
          id="save-params-btn"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-primary"
        >
          {save.isPending
            ? <><Loader2 size={14} className="animate-spin" /> Sauvegarde…</>
            : <><Save size={14} /> Sauvegarder</>
          }
        </button>
      </div>

      {/* ── Informations entreprise ──────────────────────── */}
      <Section icon={Building2} title="Informations de l'entreprise">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Nom de l'entreprise</label>
            <input className="input" placeholder="Mon Entreprise" {...f('nom_entreprise')} />
          </div>
          <div className="form-group">
            <label className="label">SIRET</label>
            <input className="input font-mono" placeholder="99039012200028" {...f('siret')} />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="contact@exemple.fr" {...f('email_entreprise')} />
          </div>
          <div className="form-group">
            <label className="label">Téléphone</label>
            <input className="input" placeholder="06 12 34 56 78" {...f('telephone_entreprise')} />
          </div>
          <div className="form-group sm:col-span-2">
            <label className="label">Adresse complète</label>
            <input className="input" placeholder="12 rue de la Propreté, 75001 Paris" {...f('adresse_entreprise')} />
          </div>
          <div className="form-group">
            <label className="label">Forme juridique</label>
            <input className="input" placeholder="Auto-entrepreneur, SARL, EI…" {...f('forme_juridique')} />
          </div>
        </div>
      </Section>

      {/* ── Facturation électronique (Factur-X) ──────────── */}
      <Section icon={Receipt} title="Facturation électronique (Factur-X)">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 -mt-1">
            Ces informations sont intégrées dans le fichier XML structuré embarqué dans vos factures
            (norme Factur-X, obligatoire progressivement pour les échanges B2B en France).
          </p>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={form.assujetti_tva ?? false}
              onChange={e => setForm(p => ({ ...p, assujetti_tva: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
            />
            <span className="text-sm font-medium text-slate-700">
              Je suis assujetti(e) à la TVA (décoché = franchise en base, art. 293 B du CGI)
            </span>
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            {form.assujetti_tva && (
              <div className="form-group">
                <label className="label">Taux de TVA appliqué (%)</label>
                <input
                  type="number" min="0" max="100" step="0.1"
                  className="input"
                  value={form.taux_tva ?? 0}
                  onChange={e => setForm(p => ({ ...p, taux_tva: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            )}
            <div className="form-group">
              <label className="label">N° TVA intracommunautaire</label>
              <input className="input font-mono" placeholder="FR12345678900" {...f('tva_intracommunautaire')} />
              <p className="text-xs text-slate-400 mt-1">Laisser vide si non applicable (franchise en base)</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="form-group">
              <label className="label">IBAN (pour paiement des factures)</label>
              <input className="input font-mono" placeholder="FR76 3000 0000 0000 0000 0000 000" {...f('iban')} />
            </div>
            <div className="form-group">
              <label className="label">BIC / SWIFT</label>
              <input className="input font-mono" placeholder="BNPAFRPPXXX" {...f('bic')} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Documents PDF ────────────────────────────────── */}
      <Section icon={FileText} title="Documents (Devis & Factures PDF)">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Logo de l'entreprise</label>
              <label className={`flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed cursor-pointer transition-colors
                ${form.logo_url ? 'border-slate-200 bg-slate-50/50' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/30'}
                ${uploadingLogo ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploadingLogo ? (
                  <Loader2 size={20} className="animate-spin text-brand-600" />
                ) : form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="h-16 object-contain" />
                ) : (
                  <>
                    <Upload size={20} className="text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">Choisir un fichier image</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'logos', 'logo_url', setUploadingLogo) }} />
              </label>
              {form.logo_url && (
                <button type="button" onClick={() => setForm(p => ({ ...p, logo_url: '' }))}
                  className="text-xs text-red-500 hover:underline mt-1">Retirer le logo</button>
              )}
            </div>

            <div className="form-group">
              <label className="label">Signature du prestataire</label>
              <label className={`flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed cursor-pointer transition-colors
                ${form.signature_url ? 'border-slate-200 bg-slate-50/50' : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/30'}
                ${uploadingSig ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploadingSig ? (
                  <Loader2 size={20} className="animate-spin text-brand-600" />
                ) : form.signature_url ? (
                  <img src={form.signature_url} alt="Signature" className="h-16 object-contain" />
                ) : (
                  <>
                    <Upload size={20} className="text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">Choisir un fichier image</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const fi = e.target.files?.[0]; if (fi) uploadFile(fi, 'signatures', 'signature_url', setUploadingSig) }} />
              </label>
              {form.signature_url && (
                <button type="button" onClick={() => setForm(p => ({ ...p, signature_url: '' }))}
                  className="text-xs text-red-500 hover:underline mt-1">Retirer la signature</button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Mentions légales (pied de page PDF)</label>
            <textarea
              className="input resize-none"
              rows={4}
              value={form.mentions_legales ?? ''}
              onChange={e => setForm(p => ({ ...p, mentions_legales: e.target.value }))}
            />
            <p className="text-xs text-slate-400 mt-1">
              Affiché en bas de chaque devis et facture. SIRET, régime TVA, conditions de disponibilité.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Avis Google ──────────────────────────────────── */}
      <Section icon={Star} title="Encart Avis Google (PDF)">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="form-group sm:col-span-3">
              <label className="label">Lien page Google Avis</label>
              <input className="input" placeholder="https://g.page/r/…" {...f('avis_google_url')} />
            </div>
            <div className="form-group">
              <label className="label">Note (sur 5)</label>
              <input
                type="text" inputMode="decimal"
                className="input"
                value={form.note_google ?? 5}
                onChange={e => {
                  const raw = e.target.value.replace(',', '.')
                  // On garde la valeur brute pendant la saisie pour ne pas bloquer
                  // la virgule (ex: "4," avant de taper le chiffre final)
                  // mais on valide que ça ressemble à un nombre
                  if (raw === '' || raw === '.' || /^\d*\.?\d*$/.test(raw)) {
                    const parsed = parseFloat(raw)
                    setForm(p => ({ ...p, note_google: isNaN(parsed) ? 0 : Math.min(5, Math.max(0, parsed)) }))
                  }
                }}
              />
            </div>
            <div className="form-group">
              <label className="label">Nombre d'avis</label>
              <input
                type="number" min="0"
                className="input"
                value={form.nombre_avis_google ?? 0}
                onChange={e => setForm(p => ({ ...p, nombre_avis_google: parseInt(e.target.value) }))}
              />
            </div>
            <div className="form-group flex flex-col justify-end">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                <p className="text-amber-500 text-lg tracking-wider">
                  {formatStars(form.note_google ?? 5)}
                </p>
                <p className="text-xs text-amber-700 font-medium mt-0.5">
                  {form.note_google}/5 · {form.nombre_avis_google} avis
                </p>
              </div>
            </div>
          </div>

          {/* Affichage sur devis/factures */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Afficher cet encart sur :</p>
            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={form.afficher_avis_sur_devis ?? true}
                onChange={e => setForm(p => ({ ...p, afficher_avis_sur_devis: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">Les devis</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={form.afficher_avis_sur_factures ?? true}
                onChange={e => setForm(p => ({ ...p, afficher_avis_sur_factures: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">Les factures</span>
            </label>
          </div>
        </div>
      </Section>

      {/* ── Catalogue de prestations ─────────────────────── */}
      <Section icon={ShoppingBag} title="Catalogue de prestations">
        <CatalogueSection />
      </Section>

      {/* ── Relances automatiques ────────────────────────── */}
      <RemindersSection />

      {/* ── Numérotation ─────────────────────────────────── */}
      {params && (
        <div className="card border border-brand-100 bg-brand-50/50">
          <h3 className="font-semibold text-brand-800 mb-3 flex items-center gap-2">
            <FileText size={16} /> Numérotation actuelle
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Prochain numéro de devis</p>
              <p className="font-bold text-brand-700 text-lg">D-{String(params.prochain_num_devis).padStart(4, '0')}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Prochain numéro de facture</p>
              <p className="font-bold text-brand-700 text-lg">F-{String(params.prochain_num_facture).padStart(4, '0')}</p>
            </div>
          </div>
          <p className="text-xs text-brand-600 mt-3">
            🔒 Numérotation gérée côté serveur avec verrou PostgreSQL — aucun doublon possible.
          </p>
        </div>
      )}

      {/* Bouton bas de page */}
      <div className="flex justify-end pb-6">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-primary btn-lg"
        >
          {save.isPending
            ? <><Loader2 size={16} className="animate-spin" /> Sauvegarde…</>
            : <><Save size={16} /> Sauvegarder les paramètres</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Composant Section ─────────────────────────────────────────
function Section({
  icon: Icon, title, children
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 mb-5">
        <span className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
          <Icon size={15} className="text-brand-700" />
        </span>
        {title}
      </h2>
      {children}
    </div>
  )
}
