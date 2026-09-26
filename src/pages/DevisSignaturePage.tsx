import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatEuros, formatDate } from '@/lib/utils'
import type { DevisSignaturePublic } from '@/types/database'
import { FileText, CheckCircle2, XCircle, Loader2, PenTool, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DevisSignaturePage() {
  const { token } = useParams<{ token: string }>()
  const [confirming, setConfirming] = useState<'signe' | 'refuse' | null>(null)
  const [nomSignataire, setNomSignataire] = useState('')

  const { data, isLoading, refetch } = useQuery<DevisSignaturePublic>({
    queryKey: ['devis-signature', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_devis_signature', { p_token: token })
      if (error) throw error
      return data as DevisSignaturePublic
    },
    enabled: !!token,
  })

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

  const { devis, client, entreprise, lignes = [] } = data
  const dejaRepondu = devis.statut !== 'en_attente'

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="text-center">
          {entreprise?.logo_url && (
            <img src={entreprise.logo_url} alt="" className="h-12 mx-auto mb-3 object-contain" />
          )}
        </div>

        <div className="card space-y-6">
          {/* ── En-tête : émetteur / client ──────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <p className="font-bold text-slate-800">{entreprise?.nom_entreprise}</p>
              {entreprise?.adresse_entreprise && <p className="text-xs text-slate-400">{entreprise.adresse_entreprise}</p>}
              {entreprise?.siret && <p className="text-xs text-slate-400">SIRET : {entreprise.siret}</p>}
              {entreprise?.telephone_entreprise && <p className="text-xs text-slate-400">{entreprise.telephone_entreprise}</p>}
              {entreprise?.email_entreprise && <p className="text-xs text-slate-400">{entreprise.email_entreprise}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Destinataire</p>
              <p className="font-semibold text-slate-700">
                {client?.type_client === 'professionnel' && client.nom_entreprise ? client.nom_entreprise : client?.nom}
              </p>
              {client?.type_client === 'professionnel' && client.nom_entreprise && (
                <p className="text-xs text-slate-400">{client.nom}</p>
              )}
              {client?.adresse && <p className="text-xs text-slate-400">{client.adresse}</p>}
              {(client?.code_postal || client?.ville) && (
                <p className="text-xs text-slate-400">{[client.code_postal, client.ville].filter(Boolean).join(' ')}</p>
              )}
              {client?.siret && <p className="text-xs text-slate-400">SIRET : {client.siret}</p>}
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{devis.titre || 'Devis'}</h1>
              <p className="text-sm text-slate-400">{devis.numero}</p>
            </div>
            <span className="badge badge-blue">{formatDate(devis.date_creation)}</span>
          </div>

          {lignes.length > 0 && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                <span>Description</span>
                <span className="text-right">Qté</span>
                <span className="text-right">Prix unitaire</span>
                <span className="text-right">Montant</span>
              </div>
              <div className="divide-y divide-slate-100">
                {lignes.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{l.description}</p>
                      {l.detail && <p className="text-xs text-slate-400">{l.detail}</p>}
                    </div>
                    <span className="text-sm text-slate-500 text-right">{l.quantite} {l.unite}</span>
                    <span className="text-sm text-slate-500 text-right">{formatEuros(l.prix_unitaire)}</span>
                    <span className="text-sm font-bold text-slate-700 text-right">{formatEuros(l.montant_ligne)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 bg-brand-50 rounded-2xl">
            <span className="font-bold text-brand-800">Total</span>
            <span className="text-xl font-extrabold text-brand-800">{formatEuros(devis.montant_total)}</span>
          </div>

          {devis.date_validite && (
            <p className="text-xs text-slate-400 text-center">Devis valable jusqu'au {formatDate(devis.date_validite)}</p>
          )}

          {devis.notes_client && (
            <p className="text-sm text-slate-500 border-t border-slate-100 pt-4 whitespace-pre-wrap">{devis.notes_client}</p>
          )}

          {entreprise?.mentions_legales && (
            <p className="text-[10px] text-slate-300 border-t border-slate-100 pt-3 whitespace-pre-wrap">{entreprise.mentions_legales}</p>
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
