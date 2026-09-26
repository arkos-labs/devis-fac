import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { DevisSignaturePublic, Devis, Client, ParametresCompte, LignePrestation } from '@/types/database'
import { generateDocumentPdf } from '@/lib/pdf-generator'
import { FileText, CheckCircle2, XCircle, Loader2, PenTool, ShieldCheck, Download } from 'lucide-react'
import toast from 'react-hot-toast'

// Reconstruit des objets compatibles avec le générateur PDF interne à partir
// des données (volontairement limitées) exposées par le RPC public.
function buildPdfInput(data: DevisSignaturePublic, token: string) {
  const { devis, client, entreprise, lignes = [] } = data
  if (!devis || !client || !entreprise) return null

  const documentForPdf = {
    id: devis.id, user_id: '', client_id: '', numero: devis.numero,
    date_creation: devis.date_creation, date_validite: devis.date_validite,
    statut: devis.statut, montant_ht: devis.montant_ht, montant_total: devis.montant_total,
    notes_client: devis.notes_client, notes_internes: null, titre: devis.titre,
    genere_par_ia: false, prompt_ia: null,
    note_google_snapshot: devis.note_google_snapshot, nombre_avis_google_snapshot: devis.nombre_avis_google_snapshot,
    signature_activee: true, signature_token: token, signature_date: devis.signature_date,
    signature_nom_signataire: devis.signature_nom_signataire,
    created_at: devis.date_creation, updated_at: devis.date_creation,
  } as Devis

  const clientForPdf = {
    id: '', user_id: '', type_client: client.type_client,
    nom: client.nom, nom_entreprise: client.nom_entreprise,
    siret: client.siret, tva_intracommunautaire: client.tva_intracommunautaire,
    email: client.email, telephone: client.telephone,
    adresse: client.adresse, ville: client.ville, code_postal: client.code_postal,
    notes: null, date_creation: devis.date_creation, dernier_contact: null,
  } as Client

  const parametresForPdf = {
    id: '', user_id: '', nom_entreprise: entreprise.nom_entreprise,
    siret: entreprise.siret ?? '', adresse_entreprise: entreprise.adresse_entreprise,
    telephone_entreprise: entreprise.telephone_entreprise, email_entreprise: entreprise.email_entreprise,
    logo_url: entreprise.logo_url, signature_url: entreprise.signature_url,
    mentions_legales: entreprise.mentions_legales ?? '',
    avis_google_url: entreprise.avis_google_url,
    note_google: entreprise.note_google ?? 5, nombre_avis_google: entreprise.nombre_avis_google ?? 0,
    afficher_avis_sur_devis: entreprise.afficher_avis_sur_devis, afficher_avis_sur_factures: true,
    prochain_num_devis: 0, prochain_num_facture: 0,
    created_at: '', updated_at: '',
    tva_intracommunautaire: entreprise.tva_intracommunautaire, iban: null, bic: null,
    forme_juridique: entreprise.forme_juridique, code_pays: 'FR',
    assujetti_tva: entreprise.assujetti_tva, taux_tva: entreprise.taux_tva,
  } as ParametresCompte

  const lignesForPdf = lignes.map((l, i) => ({
    id: String(i), user_id: '', document_type: 'devis' as const, document_id: devis.id,
    ordre: l.ordre, description: l.description, detail: l.detail,
    quantite: l.quantite, unite: l.unite, prix_unitaire: l.prix_unitaire,
    montant_ligne: l.montant_ligne, is_upsell: false, created_at: '',
  })) as LignePrestation[]

  return { document: documentForPdf, type: 'devis' as const, lignes: lignesForPdf, client: clientForPdf, parametres: parametresForPdf }
}

export default function DevisSignaturePage() {
  const { token } = useParams<{ token: string }>()
  const [confirming, setConfirming] = useState<'signe' | 'refuse' | null>(null)
  const [nomSignataire, setNomSignataire] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState(false)

  const { data, isLoading, refetch } = useQuery<DevisSignaturePublic>({
    queryKey: ['devis-signature', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_devis_signature', { p_token: token })
      if (error) throw error
      return data as DevisSignaturePublic
    },
    enabled: !!token,
  })

  // Génère le PDF côté navigateur (même moteur que le reste de l'app) dès que
  // les données du devis sont disponibles, pour l'afficher et le télécharger.
  useEffect(() => {
    if (!data?.success || !token) return
    let cancelled = false
    let objectUrl: string | null = null
    setPdfError(false)
    ;(async () => {
      try {
        const input = buildPdfInput(data, token)
        if (!input) throw new Error('Données incomplètes')
        const bytes = await generateDocumentPdf(input)
        if (cancelled) return
        objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
        setPdfUrl(objectUrl)
      } catch {
        if (!cancelled) setPdfError(true)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [data, token])

  const repondre = useMutation({
    mutationFn: async (reponse: 'signe' | 'refuse') => {
      const { data, error } = await supabase.rpc('repondre_devis_signature', {
        p_token: token, p_reponse: reponse, p_nom: reponse === 'signe' ? nomSignataire.trim() : undefined,
      })
      if (error) throw error
      return data as { success: boolean; error?: string }
    },
    onSuccess: (res) => {
      if (!res.success) {
        setConfirming(null)
        if (res.error === 'deja_traite') toast.error('Ce devis a déjà reçu une réponse.')
        else if (res.error === 'nom_requis') toast.error('Merci de saisir votre nom complet pour signer.')
        else toast.error('Une erreur est survenue.')
        return
      }
      toast.success(confirming === 'signe' ? 'Devis signé avec succès !' : 'Devis refusé.')
      setConfirming(null)
      refetch()
    },
    onError: () => {
      setConfirming(null)
      toast.error('Une erreur est survenue, veuillez réessayer.')
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    )
  }

  if (!data?.success || !data.devis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center card">
          <FileText size={40} className="mx-auto text-slate-300 mb-4" />
          <h1 className="text-lg font-bold text-slate-700">Lien invalide ou expiré</h1>
          <p className="text-sm text-slate-400 mt-2">
            Ce lien de signature n'est plus valide. Contactez l'émetteur du devis pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    )
  }

  const { devis } = data
  const dejaRepondu = devis.statut !== 'en_attente'

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{devis.titre || 'Devis'}</h1>
            <p className="text-sm text-slate-400">{devis.numero}</p>
          </div>
          {pdfUrl && (
            <a href={pdfUrl} download={`${devis.numero}.pdf`} className="btn-secondary btn-sm gap-1.5">
              <Download size={13} /> Télécharger le PDF
            </a>
          )}
        </div>

        {/* ── Aperçu du document PDF ────────────────────────── */}
        <div className="card p-2 sm:p-3">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title={`Devis ${devis.numero}`}
              className="w-full h-[70vh] rounded-xl border border-slate-100"
            />
          ) : pdfError ? (
            <div className="py-16 text-center">
              <FileText size={36} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">Impossible d'afficher l'aperçu du devis.</p>
            </div>
          ) : (
            <div className="py-16 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-brand-500" />
            </div>
          )}
        </div>

        {/* ── État / actions de signature ─────────────────── */}
        <div className="card">
          {dejaRepondu ? (
            <div className="text-center py-4">
              {devis.statut === 'signe' ? (
                <>
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                  <p className="font-bold text-emerald-700">Vous avez signé ce devis</p>
                  {devis.signature_nom_signataire && (
                    <p className="text-sm text-slate-500 mt-1">Signé par <span className="font-semibold">{devis.signature_nom_signataire}</span></p>
                  )}
                  {devis.signature_date && (
                    <p className="text-xs text-slate-400 mt-1">le {formatDate(devis.signature_date)}</p>
                  )}
                </>
              ) : devis.statut === 'refuse' ? (
                <>
                  <XCircle size={36} className="mx-auto text-red-500 mb-2" />
                  <p className="font-bold text-red-700">Vous avez refusé ce devis</p>
                </>
              ) : (
                <p className="font-semibold text-slate-500">Ce devis a déjà été traité (statut : {devis.statut}).</p>
              )}
            </div>
          ) : confirming ? (
            <div className="py-2 space-y-4">
              <p className="text-sm font-semibold text-slate-700 text-center">
                {confirming === 'signe'
                  ? 'Confirmez-vous la signature de ce devis ?'
                  : 'Confirmez-vous le refus de ce devis ?'}
              </p>

              {confirming === 'signe' && (
                <div className="max-w-sm mx-auto">
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">
                    Votre nom complet <span className="text-slate-400 font-normal">(fait office de signature)</span>
                  </label>
                  <input
                    autoFocus
                    value={nomSignataire}
                    onChange={e => setNomSignataire(e.target.value)}
                    placeholder="Prénom Nom"
                    className="input text-lg italic"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button className="btn-secondary" onClick={() => setConfirming(null)} disabled={repondre.isPending}>
                  Annuler
                </button>
                <button
                  className={confirming === 'signe' ? 'btn-primary gap-1.5' : 'btn bg-red-600 text-white hover:bg-red-700 gap-1.5'}
                  onClick={() => repondre.mutate(confirming)}
                  disabled={repondre.isPending || (confirming === 'signe' && !nomSignataire.trim())}
                >
                  {repondre.isPending
                    ? <Loader2 size={14} className="animate-spin" />
                    : confirming === 'signe' ? <PenTool size={14} /> : <XCircle size={14} />}
                  Confirmer
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button className="btn bg-red-50 text-red-700 hover:bg-red-100 flex-1 gap-1.5" onClick={() => setConfirming('refuse')}>
                <XCircle size={15} /> Refuser le devis
              </button>
              <button className="btn-primary flex-1 gap-1.5" onClick={() => setConfirming('signe')}>
                <PenTool size={15} /> Signer le devis
              </button>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck size={12} /> Signature électronique sécurisée
        </p>
      </div>
    </div>
  )
}
