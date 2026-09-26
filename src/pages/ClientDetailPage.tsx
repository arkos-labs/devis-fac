import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/lib/useSubscription'
import { formatDate, formatEuros, getInitiales } from '@/lib/utils'
import type { Client, Devis, Facture } from '@/types/database'
import {
  ArrowLeft, Phone, Mail, MapPin, CalendarPlus, Euro,
  FileText, Receipt, TrendingUp, Clock, CheckCircle2,
  AlertCircle, XCircle, ExternalLink, Calendar, User,
  ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import DevisModal, { type LigneForm as DevisLigneForm, type DevisFormData } from '@/components/devis/DevisModal'
import FactureModal, { type LigneForm as FactureLigneForm, type FactureFormData } from '@/components/factures/FactureModal'
import { useDocumentDownload } from '@/lib/useDocumentDownload'

// ── Helpers ───────────────────────────────────────────────────
function badgeDevis(statut: string) {
  const map: Record<string, string> = {
    brouillon: 'badge-slate',
    envoye: 'badge-blue',
    accepte: 'badge-green',
    refuse: 'badge-red',
    expire: 'badge-amber',
  }
  const labels: Record<string, string> = {
    brouillon: 'Brouillon', envoye: 'Envoyé',
    accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré',
  }
  return <span className={`badge ${map[statut] ?? 'badge-slate'}`}>{labels[statut] ?? statut}</span>
}

function badgeFacture(statut: string) {
  const map: Record<string, string> = {
    brouillon: 'badge-slate',
    envoyee: 'badge-blue',
    payee: 'badge-green',
    partielle: 'badge-amber',
    retard: 'badge-red',
    annulee: 'badge-red',
  }
  const labels: Record<string, string> = {
    brouillon: 'Brouillon', envoyee: 'Envoyée', payee: 'Payée',
    partielle: 'Partiel', retard: 'En retard', annulee: 'Annulée',
  }
  return <span className={`badge ${map[statut] ?? 'badge-slate'}`}>{labels[statut] ?? statut}</span>
}

// ── KPI Card ──────────────────────────────────────────────────
interface KpiProps { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }
function KpiCard({ label, value, sub, color, icon }: KpiProps) {
  return (
    <div className="card flex items-center gap-4 py-4">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-extrabold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Modal planification Google Calendar ───────────────────────
interface PlanModalProps { client: Client; onClose: () => void }
function PlanModal({ client, onClose }: PlanModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]       = useState(today)
  const [heure, setHeure]     = useState('09:00')
  const [duree, setDuree]     = useState('2')
  const [desc, setDesc]       = useState('Rendez-vous')
  const [tarif, setTarif]     = useState('')
  const [adresse, setAdresse] = useState(
    [client.adresse, client.ville, client.code_postal].filter(Boolean).join(', ')
  )

  const openCalendar = () => {
    const start = new Date(`${date}T${heure}`)
    const end   = new Date(start.getTime() + Number(duree) * 60 * 60 * 1000)

    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

    const details = [
      `Client : ${client.nom}`,
      client.telephone ? `Tél : ${client.telephone}` : '',
      client.email ? `Email : ${client.email}` : '',
      tarif ? `Tarif : ${tarif} €` : '',
      client.notes ? `Notes : ${client.notes}` : '',
    ].filter(Boolean).join('\n')

    const params = new URLSearchParams({
      text:     `${desc} — ${client.nom}`,
      dates:    `${fmt(start)}/${fmt(end)}`,
      details,
      location: adresse,
    })

    window.open(`https://calendar.google.com/calendar/r/eventnew?${params}`, '_blank')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <CalendarPlus size={18} className="text-blue-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Planifier une prestation</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
            <XCircle size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <User size={14} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-700">{client.nom}</span>
          </div>

          <div className="form-group">
            <label className="label">Description de la prestation</label>
            <input className="input" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Consultation, livraison…" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Heure de début</label>
              <input type="time" className="input" value={heure} onChange={e => setHeure(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Durée (heures)</label>
              <select className="input" value={duree} onChange={e => setDuree(e.target.value)}>
                {['1','1.5','2','2.5','3','4','5','6'].map(v => (
                  <option key={v} value={v}>{v}h</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Tarif estimé (€)</label>
              <input type="number" className="input" placeholder="150" value={tarif}
                onChange={e => setTarif(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Adresse d'intervention</label>
            <input className="input" value={adresse} onChange={e => setAdresse(e.target.value)}
              placeholder="12 rue de la Paix, Paris" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button onClick={openCalendar} className="btn-primary flex-1 gap-2">
              <ExternalLink size={15} />
              Ouvrir Google Calendar
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            L'événement s'ouvrira dans Google Calendar — vous n'aurez qu'à cliquer sur Enregistrer.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────
export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isActive: isSubscribed } = useSubscription()
  const qc = useQueryClient()
  const { sendByEmail } = useDocumentDownload()
  const [showPlan, setShowPlan] = useState(false)
  const [showDevisModal, setShowDevisModal] = useState(false)
  const [showFactureModal, setShowFactureModal] = useState(false)

  const { data: client, isLoading: loadingClient } = useQuery<Client>({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients').select('*').eq('id', id!).eq('user_id', user!.id).single()
      if (error) throw error
      return data as Client
    },
    enabled: !!user && !!id,
  })

  const { data: devisList = [] } = useQuery<Devis[]>({
    queryKey: ['client-devis', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devis').select('*').eq('client_id', id!).eq('user_id', user!.id)
        .order('date_creation', { ascending: false })
      if (error) throw error
      return (data ?? []) as Devis[]
    },
    enabled: !!user && !!id,
  })

  const { data: facturesList = [] } = useQuery<Facture[]>({
    queryKey: ['client-factures', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('factures').select('*').eq('client_id', id!).eq('user_id', user!.id)
        .order('date_creation', { ascending: false })
      if (error) throw error
      return (data ?? []) as Facture[]
    },
    enabled: !!user && !!id,
  })

  const saveDevis = useMutation({
    mutationFn: async ({ form, lignes }: { form: DevisFormData; lignes: DevisLigneForm[]; send?: boolean }) => {
      if (!isSubscribed) throw new Error('Abonnez-vous pour créer un devis')
      const { data: numero, error: numError } = await supabase.rpc('get_next_numero', {
        p_user_id: user!.id, p_type: 'devis'
      })
      if (numError) throw numError

      const { data: params } = await supabase
        .from('parametres_compte').select('note_google, nombre_avis_google').eq('user_id', user!.id).single()

      const { data: newDevis, error } = await supabase.from('devis').insert({
        user_id: user!.id,
        client_id: form.client_id,
        numero: numero as string,
        date_validite: form.date_validite || null,
        notes_client: form.notes_client || null,
        notes_internes: form.notes_internes || null,
        titre: form.titre || null,
        genere_par_ia: form.genere_par_ia,
        prompt_ia: form.prompt_ia || null,
        statut: 'en_attente',
        note_google_snapshot: params?.note_google ?? null,
        nombre_avis_google_snapshot: params?.nombre_avis_google ?? null,
      }).select().single()
      if (error) throw error

      const { error: lignesError } = await supabase.from('lignes_prestation').insert(
        lignes.map((l, i) => ({
          user_id: user!.id,
          document_type: 'devis' as const,
          document_id: newDevis.id,
          ordre: i,
          description: l.description,
          detail: l.detail || null,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire: l.prix_unitaire,
        }))
      )
      if (lignesError) throw lignesError

      const { data: fullDevis } = await supabase.from('devis').select('*').eq('id', newDevis.id).single()
      return fullDevis as unknown as Devis
    },
    onSuccess: async (fullDevis, variables) => {
      qc.invalidateQueries({ queryKey: ['client-devis', id] })
      qc.invalidateQueries({ queryKey: ['devis'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Devis créé !')
      setShowDevisModal(false)
      if (variables.send && fullDevis && client) {
        await sendByEmail(fullDevis, 'devis', client.email || '')
      }
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  const saveFacture = useMutation({
    mutationFn: async ({ form, lignes }: { form: FactureFormData; lignes: FactureLigneForm[]; send?: boolean }) => {
      if (!isSubscribed) throw new Error('Abonnez-vous pour créer une facture')
      const { data: numero, error: numError } = await supabase.rpc('get_next_numero', {
        p_user_id: user!.id, p_type: 'facture'
      })
      if (numError) throw numError

      const { data: params } = await supabase
        .from('parametres_compte').select('note_google, nombre_avis_google').eq('user_id', user!.id).single()

      const montantTotal = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)

      const { data: newFacture, error } = await supabase.from('factures').insert({
        user_id: user!.id,
        client_id: form.client_id,
        devis_id: null,
        numero: numero as string,
        date_creation: new Date().toISOString(),
        date_echeance: form.date_echeance || null,
        notes_client: form.notes_client || null,
        notes_internes: form.notes_internes || null,
        titre: form.titre || null,
        statut: 'en_attente',
        montant_ht: montantTotal,
        montant_total: montantTotal,
        note_google_snapshot: params?.note_google ?? null,
        nombre_avis_google_snapshot: params?.nombre_avis_google ?? null,
      }).select().single()
      if (error) throw error

      const { error: lignesError } = await supabase.from('lignes_prestation').insert(
        lignes.map((l, i) => ({
          user_id: user!.id,
          document_type: 'facture' as const,
          document_id: newFacture.id,
          ordre: i,
          description: l.description,
          detail: l.detail || null,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire: l.prix_unitaire,
        }))
      )
      if (lignesError) throw lignesError
      return newFacture as unknown as Facture
    },
    onSuccess: async (newFacture, variables) => {
      qc.invalidateQueries({ queryKey: ['client-factures', id] })
      qc.invalidateQueries({ queryKey: ['factures'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Facture créée !')
      setShowFactureModal(false)
      if (variables.send && newFacture && client) {
        await sendByEmail(newFacture, 'facture', client.email || '')
      }
    },
    onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
  })

  // Stats calculées côté client pour éviter une 3e requête
  const totalDepense = facturesList
    .filter(f => ['payee', 'partielle'].includes(f.statut))
    .reduce((s, f) => s + (f.montant_total ?? 0), 0)

  const totalDevis = devisList
    .filter(d => d.statut === 'accepte')
    .reduce((s, d) => s + (d.montant_total ?? 0), 0)

  const facturesEnRetard = facturesList.filter(f => f.statut === 'retard').length

  if (loadingClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle size={40} className="text-slate-300" />
        <p className="text-slate-500">Client introuvable.</p>
        <button onClick={() => navigate('/clients')} className="btn-secondary btn-sm">
          ← Retour aux clients
        </button>
      </div>
    )
  }

  const initiales = getInitiales(client.nom)
  const adresse = [client.adresse, client.ville, client.code_postal].filter(Boolean).join(', ')

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── Fil d'Ariane ──────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link to="/clients" className="hover:text-brand-600 transition-colors font-medium flex items-center gap-1.5">
          <ArrowLeft size={14} />
          Clients
        </Link>
        <ChevronRight size={13} />
        <span className="text-slate-600 font-semibold">{client.nom}</span>
      </nav>

      {/* ── Header client ─────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-extrabold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #6366f1)' }}
          >
            {initiales}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">{client.nom}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {client.email && (
                <a href={`mailto:${client.email}`}
                   className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 transition-colors">
                  <Mail size={13} /> {client.email}
                </a>
              )}
              {client.telephone && (
                <a href={`tel:${client.telephone}`}
                   className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 transition-colors">
                  <Phone size={13} /> {client.telephone}
                </a>
              )}
              {adresse && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin size={13} /> {adresse}
                </span>
              )}
              {client.dernier_contact && (
                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Clock size={13} /> Dernier contact : {formatDate(client.dernier_contact)}
                </span>
              )}
            </div>
            {client.notes && (
              <p className="mt-2 text-sm text-slate-500 italic bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                {client.notes}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowPlan(true)}
              className="btn-primary gap-2"
            >
              <CalendarPlus size={15} />
              <span className="hidden sm:inline">Planifier</span>
            </button>
            <button
              onClick={() => setShowFactureModal(true)}
              disabled={!isSubscribed}
              title={isSubscribed ? undefined : 'Abonnement requis'}
              className="btn-secondary gap-2 hidden sm:flex disabled:opacity-40"
            >
              <Receipt size={15} />
              Nouvelle facture
            </button>
            <button
              onClick={() => setShowDevisModal(true)}
              disabled={!isSubscribed}
              title={isSubscribed ? undefined : 'Abonnement requis'}
              className="btn-secondary gap-2 hidden sm:flex disabled:opacity-40"
            >
              <FileText size={15} />
              Nouveau devis
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total dépensé"
          value={formatEuros(totalDepense)}
          sub="factures payées"
          color="bg-emerald-100"
          icon={<Euro size={20} className="text-emerald-600" />}
        />
        <KpiCard
          label="Devis acceptés"
          value={formatEuros(totalDevis)}
          sub={`${devisList.filter(d => d.statut === 'accepte').length} devis`}
          color="bg-brand-100"
          icon={<TrendingUp size={20} className="text-brand-600" />}
        />
        <KpiCard
          label="Factures"
          value={String(facturesList.length)}
          sub={`${facturesList.filter(f => f.statut === 'payee').length} payées`}
          color="bg-violet-100"
          icon={<Receipt size={20} className="text-violet-600" />}
        />
        <KpiCard
          label={facturesEnRetard > 0 ? 'En retard' : 'Devis'}
          value={facturesEnRetard > 0 ? String(facturesEnRetard) : String(devisList.length)}
          sub={facturesEnRetard > 0 ? 'factures en retard' : `dont ${devisList.filter(d => d.statut === 'en_attente').length} envoyés`}
          color={facturesEnRetard > 0 ? 'bg-red-100' : 'bg-amber-100'}
          icon={facturesEnRetard > 0
            ? <AlertCircle size={20} className="text-red-600" />
            : <FileText size={20} className="text-amber-600" />}
        />
      </div>

      {/* ── Factures ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Receipt size={16} className="text-violet-500" />
            Factures
            {facturesList.length > 0 && (
              <span className="badge badge-slate">{facturesList.length}</span>
            )}
          </h2>
          <Link to={`/factures?client=${id}`} className="text-xs text-brand-600 hover:underline font-semibold">
            Voir tout →
          </Link>
        </div>

        {facturesList.length === 0 ? (
          <div className="card text-center py-10 text-slate-400">
            <Receipt size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune facture pour ce client</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">N°</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Échéance</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Montant</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Paiement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {facturesList.map(f => (
                    <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{f.numero}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(f.date_creation)}</td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {f.date_echeance ? formatDate(f.date_echeance) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatEuros(f.montant_total)}</td>
                      <td className="px-4 py-3 text-center">{badgeFacture(f.statut)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                        {f.date_paiement
                          ? <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 size={12} />
                              {formatDate(f.date_paiement)}
                            </span>
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Total encaissé</td>
                    <td colSpan={3} className="px-4 py-3 sm:hidden text-xs font-bold text-slate-500 uppercase">Total encaissé</td>
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-700 text-base">
                      {formatEuros(totalDepense)}
                    </td>
                    <td colSpan={2} className="hidden sm:table-cell"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Devis ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText size={16} className="text-brand-500" />
            Devis
            {devisList.length > 0 && (
              <span className="badge badge-slate">{devisList.length}</span>
            )}
          </h2>
          <Link to={`/devis?client=${id}`} className="text-xs text-brand-600 hover:underline font-semibold">
            Voir tout →
          </Link>
        </div>

        {devisList.length === 0 ? (
          <div className="card text-center py-10 text-slate-400">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun devis pour ce client</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">N°</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Validité</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Montant</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {devisList.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{d.numero}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(d.date_creation)}</td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {d.date_validite ? formatDate(d.date_validite) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatEuros(d.montant_total)}</td>
                      <td className="px-4 py-3 text-center">{badgeDevis(d.statut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Google Calendar CTA ───────────────────────────── */}
      <div
        className="card flex flex-col sm:flex-row items-center gap-4 cursor-pointer hover:shadow-card-hover transition-all"
        onClick={() => setShowPlan(true)}
        style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)' }}
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Calendar size={22} className="text-white" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="font-bold text-slate-800">Planifier une prestation</p>
          <p className="text-sm text-slate-500 mt-0.5">
            Créez un événement dans Google Calendar avec les infos du client pré-remplies.
          </p>
        </div>
        <button className="btn-primary gap-2 flex-shrink-0">
          <CalendarPlus size={15} />
          Planifier
        </button>
      </div>

      {/* ── Modal planification ────────────────────────────── */}
      {showPlan && <PlanModal client={client} onClose={() => setShowPlan(false)} />}

      {/* ── Modal nouveau devis (pré-rempli pour ce client) ──── */}
      {showDevisModal && (
        <DevisModal
          initialClientId={client.id}
          onSave={(form, lignes, send) => saveDevis.mutate({ form, lignes, send })}
          onClose={() => setShowDevisModal(false)}
          isSaving={saveDevis.isPending}
        />
      )}

      {/* ── Modal nouvelle facture (pré-remplie pour ce client) ── */}
      {showFactureModal && (
        <FactureModal
          initialClientId={client.id}
          onSave={(form, lignes, send) => saveFacture.mutate({ form, lignes, send })}
          onClose={() => setShowFactureModal(false)}
          isSaving={saveFacture.isPending}
        />
      )}
    </div>
  )
}
