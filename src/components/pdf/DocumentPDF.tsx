import type { Devis, Facture, LignePrestation, ParametresCompte, Client } from '@/types/database'
import { formatEuros, formatDateLong } from '@/lib/utils'

// ── Types union ───────────────────────────────────────────────
type Document = (Devis | Facture) & {
  clients?: Client
  lignes_prestation?: LignePrestation[]
}

interface DocumentPDFProps {
  document: Document
  type: 'devis' | 'facture'
  parametres: ParametresCompte
  lignes: LignePrestation[]
}

function renderStars(note: number): string {
  const safeNote = Number(note) || 0
  const clamped = Math.max(0, Math.min(5, safeNote))
  const full  = Math.floor(clamped)
  const half  = clamped - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty)
}

export default function DocumentPDF({ document, type, parametres, lignes }: DocumentPDFProps) {
  const isDevis = type === 'devis'
  const titre = isDevis ? 'Devis' : 'Facture'
  const client = document.clients

  // Dates
  const dateEmission = formatDateLong(document.date_creation)
  let dateEcheance = ''
  
  if (isDevis) {
    const d = document as Devis
    if (d.date_validite) dateEcheance = formatDateLong(d.date_validite)
  } else {
    const f = document as Facture
    if (f.date_echeance) dateEcheance = formatDateLong(f.date_echeance)
  }

  // Totaux
  const sousTotal = lignes.reduce((s, l) => s + l.montant_ligne, 0)
  const totalTTC = sousTotal // TVA non applicable actuellement

  // Récupérer les données de snapshot s'il y en a (pour figer l'historique), sinon celles en temps réel
  const docAvisNote = (document as any).note_google_snapshot ?? parametres.note_google ?? 5
  const docAvisCount = (document as any).nombre_avis_google_snapshot ?? parametres.nombre_avis_google ?? 0

  return (
    <div className="bg-white p-12 md:p-16 w-full max-w-4xl border border-transparent print:border-none print:shadow-none print:m-0 print:p-0 mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>

      <header className="flex justify-between items-end border-b-2 border-neutral-900 pb-6 mb-10 gap-4">
        <div className="flex flex-col items-start">
          {parametres.logo_url ? (
            <img src={parametres.logo_url} alt="Logo de l'entreprise" className="h-16 w-auto object-contain mb-5" />
          ) : (
            <div className="text-2xl font-bold text-neutral-900 mb-5">{parametres.nom_entreprise}</div>
          )}
          <h1 className="text-4xl font-light text-neutral-900 tracking-widest uppercase">{titre}</h1>
        </div>
        <div className="text-right">
          <p className="text-neutral-500 text-sm mb-1">{titre} N° <span className="font-medium text-neutral-900">{document.numero}</span></p>
          <p className="text-neutral-500 text-sm mb-1">Date d'émission : <span className="font-medium text-neutral-900">{dateEmission}</span></p>
          {dateEcheance && (
            <p className="text-neutral-500 text-sm">
              {isDevis ? 'Validité' : 'Échéance'} : <span className="font-medium text-neutral-900">{dateEcheance}</span>
            </p>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 mb-12 break-inside-avoid">
        {/* Carte 1 : ÉMETTEUR */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Émetteur</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                Prestataire
              </span>
            </div>
            
            <div className="flex items-start gap-3 mt-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
              </div>
              <div>
                <h3 className="m-0 text-base font-bold text-slate-900">{parametres.nom_entreprise}</h3>
                <p className="m-0 mt-0.5 text-xs text-slate-500">Entreprise</p>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-600 flex flex-col gap-2">
              {parametres.adresse_entreprise && (
                <div className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <span>{parametres.adresse_entreprise}</span>
                </div>
              )}
              {parametres.email_entreprise && (
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <span>{parametres.email_entreprise}</span>
                </div>
              )}
              {parametres.telephone_entreprise && (
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  <span>{parametres.telephone_entreprise}</span>
                </div>
              )}
            </div>
          </div>
          {parametres.siret && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <span className="font-medium text-slate-400 uppercase tracking-widest">N° SIRET</span>
              <span className="font-mono font-semibold px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-700">
                {parametres.siret}
              </span>
            </div>
          )}
        </div>

        {/* Carte 2 : DESTINATAIRE */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {isDevis ? 'Adressé à' : 'Facturé à'}
                </span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
                Client
              </span>
            </div>
            
            <div className="flex items-start gap-3 mt-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
              </div>
              <div>
                <h3 className="m-0 text-base font-bold text-slate-900">{client?.nom || '—'}</h3>
                <p className="m-0 mt-0.5 text-xs text-slate-500">Profil client</p>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-600 flex flex-col gap-2">
              {(client?.adresse || client?.code_postal || client?.ville) && (
                <div className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <div>
                    {client?.adresse && <div>{client.adresse}</div>}
                    {(client?.code_postal || client?.ville) && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{[client.code_postal, client.ville].filter(Boolean).join(' ')}</div>
                    )}
                  </div>
                </div>
              )}
              {client?.email && (
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <span>{client.email}</span>
                </div>
              )}
              {client?.telephone && (
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  <span>{client.telephone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-900 text-xs uppercase tracking-widest text-neutral-500">
                <th className="py-3 pr-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold text-center w-24">Qté</th>
                <th className="py-3 px-4 font-semibold text-right w-32">PU (HT)</th>
                <th className="py-3 pl-4 font-semibold text-right w-32">Total (HT)</th>
              </tr>
            </thead>
            <tbody className="text-sm text-neutral-700">
              {lignes.length === 0 ? (
                <tr className="border-b border-neutral-200">
                  <td colSpan={4} className="py-8 text-center text-neutral-400">Aucune prestation</td>
                </tr>
              ) : (
                lignes.sort((a,b) => a.ordre - b.ordre).map((l, i) => (
                  <tr key={l.id ?? i} className="border-b border-neutral-200 break-inside-avoid">
                    <td className="py-4 pr-4">
                      <p className="font-medium text-neutral-900">{l.description}</p>
                      {l.detail && <p className="text-xs text-neutral-500 mt-1">{l.detail}</p>}
                    </td>
                    <td className="py-4 px-4 text-center align-top">
                      {l.quantite} {l.unite !== 'forfait' && l.unite}
                    </td>
                    <td className="py-4 px-4 text-right align-top whitespace-nowrap">{formatEuros(l.prix_unitaire)}</td>
                    <td className="py-4 pl-4 text-right font-medium text-neutral-900 align-top whitespace-nowrap">{formatEuros(l.montant_ligne)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex justify-end mb-16 break-inside-avoid">
        <div className="w-72">
          <div className="flex justify-between py-2 text-sm text-neutral-600 border-b border-neutral-200">
            <span>Total HT</span>
            <span className="font-medium text-neutral-900">{formatEuros(sousTotal)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm text-neutral-600 border-b border-neutral-200">
            <span>TVA</span>
            <span className="font-medium text-neutral-900">0,00 €</span>
          </div>
          <div className="flex justify-between items-center py-4 mt-2 border-b-2 border-neutral-900">
            <span className="font-bold text-neutral-900 uppercase tracking-wide">Total TTC</span>
            <span className="font-bold text-xl text-neutral-900">{formatEuros(totalTTC)}</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-2 text-right">
            TVA non applicable, art. 293 B du CGI
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-10 pt-8 mt-8 border-t border-neutral-200 text-xs text-neutral-500 break-inside-avoid">
        {/* Modalités de paiement ou Bon pour accord */}
        <div>
          {!isDevis ? (
            <>
              <h3 className="font-bold text-neutral-800 uppercase tracking-wider mb-3">Règlement</h3>
              <p className="mb-1"><span className="font-medium text-neutral-700">Échéance :</span> {dateEcheance ? dateEcheance : 'À réception'}</p>
              <p className="mb-3"><span className="font-medium text-neutral-700">Moyen :</span> Virement bancaire privilégié</p>
              
              <div className="bg-neutral-50 p-3 border border-neutral-200 rounded-sm">
                <p className="font-medium text-neutral-700 mb-1">Coordonnées bancaires</p>
                <p>Titulaire : {parametres.nom_entreprise}</p>
                <p>RIB/IBAN disponible sur demande</p>
              </div>
            </>
          ) : (
            <div className="bg-neutral-50 border border-neutral-200 p-5 h-40 flex flex-col">
              <p className="font-medium text-neutral-800 mb-2">Signature du client</p>
              <p className="text-[10px] text-neutral-500 mb-4">Précédée de la mention manuscrite "Bon pour accord", date et cachet de l'entreprise.</p>
              
              <div className="mt-auto flex justify-between items-end text-neutral-400">
                  <span>Date : ___ / ___ / ______</span>
                  <span>Signature</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Mentions légales */}
        <div>
          <h3 className="font-bold text-neutral-800 uppercase tracking-wider mb-3">
            {isDevis ? "Conditions d'acceptation" : "Conditions & Mentions"}
          </h3>
          <ul className="list-disc pl-4 space-y-1">
            {parametres.mentions_legales.split('\n').filter(Boolean).map((line, idx) => (
               <li key={idx}>{line}</li>
            ))}
            {!isDevis && (
              <>
                <li>En cas de retard de paiement, des pénalités de retard égales à 3 fois le taux d'intérêt légal seront exigibles.</li>
                <li>Indemnité forfaitaire de 40 € pour frais de recouvrement due en cas de retard de paiement.</li>
                <li>Aucun escompte ne sera accordé pour paiement anticipé.</li>
              </>
            )}
          </ul>
        </div>
      </section>

      {/* Signature du prestataire */}
      <section className="flex justify-end mt-12 break-inside-avoid">
        <div className="text-right">
           <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Le Prestataire</h3>
           {parametres.signature_url ? (
             <img src={parametres.signature_url} className="h-16 w-auto object-contain ml-auto" alt="Signature" />
           ) : (
             <div className="h-16 w-32 border-b border-neutral-300 ml-auto"></div>
           )}
           <p className="font-medium text-neutral-800 mt-2 text-sm">{parametres.nom_entreprise}</p>
        </div>
      </section>

      {/* Avis Google */}
      {(isDevis ? parametres.afficher_avis_sur_devis !== false : parametres.afficher_avis_sur_factures !== false) && (
        <section className="mt-12 pt-8 border-t border-neutral-200 flex flex-col items-center justify-center break-inside-avoid">
          <div className="flex items-center gap-5 bg-neutral-50 px-6 py-4 rounded-md border border-neutral-200">
            <div className="font-bold text-xl tracking-tighter flex gap-[1px]">
              <span className="text-blue-500">G</span><span className="text-red-500">o</span><span className="text-yellow-500">o</span><span className="text-blue-500">g</span><span className="text-green-500">l</span><span className="text-red-500">e</span>
            </div>
            <div className="w-px h-8 bg-neutral-300"></div>
            <div>
              <div className="text-yellow-500 text-lg tracking-widest leading-none mb-1">{renderStars(docAvisNote)}</div>
              <div className="text-xs text-neutral-600">
                <span className="font-bold text-neutral-800">{docAvisNote}/5</span> sur {docAvisCount} avis
              </div>
            </div>
          </div>
          {parametres.avis_google_url && (
            <p className="text-xs text-neutral-400 mt-3 text-center max-w-md">
              Satisfait(e) de notre prestation ? Laissez-nous un avis : <br/>
              <span className="text-blue-600 underline font-medium">{parametres.avis_google_url}</span>
            </p>
          )}
        </section>
      )}

    </div>
  )
}
