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

// ── Helpers ───────────────────────────────────────────────────

function getStatutLabel(doc: Document, type: 'devis' | 'facture'): { label: string; cls: string } {
  if (type === 'devis') {
    const d = doc as Devis
    return {
      en_attente: { label: 'En attente',  cls: 'pdf-statut-attente' },
      accepte:    { label: 'Accepté',     cls: 'pdf-statut-accepte' },
      refuse:     { label: 'Refusé',      cls: 'pdf-statut-refuse' },
      expire:     { label: 'Expiré',      cls: 'pdf-statut-attente' },
    }[d.statut] ?? { label: d.statut, cls: 'pdf-statut-attente' }
  } else {
    const f = doc as Facture
    return {
      en_attente: { label: 'En attente',  cls: 'pdf-statut-attente' },
      payee:      { label: 'Payée ✓',     cls: 'pdf-statut-payee' },
      retard:     { label: 'En retard',   cls: 'pdf-statut-retard' },
      annulee:    { label: 'Annulée',     cls: 'pdf-statut-refuse' },
    }[f.statut] ?? { label: f.statut, cls: 'pdf-statut-attente' }
  }
}

function renderStars(note: number): string {
  const full  = Math.floor(note)
  const half  = note - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty)
}

// ── Composant principal ───────────────────────────────────────
export default function DocumentPDF({ document, type, parametres, lignes }: DocumentPDFProps) {
  const client    = document.clients as Client | undefined
  const statut    = getStatutLabel(document, type)
  const total     = lignes.reduce((s, l) => s + l.montant_ligne, 0)
  const isDevisDoc = type === 'devis'
  const titre      = isDevisDoc ? 'DEVIS' : 'FACTURE'

  // Dates
  const dateEmission = formatDateLong(document.date_creation)
  let dateEcheance   = ''
  if (isDevisDoc && (document as Devis).date_validite) {
    dateEcheance = formatDateLong((document as Devis).date_validite)
  } else if (!isDevisDoc && (document as Facture).date_echeance) {
    dateEcheance = formatDateLong((document as Facture).date_echeance)
  }

  return (
    <div className="pdf-doc">

      {/* ── EN-TÊTE ─────────────────────────────────────────── */}
      <div className="pdf-header">
        {/* Logo */}
        <div>
          <img
            src={parametres.logo_url || '/logo.png'}
            alt={parametres.nom_entreprise}
            className="pdf-logo"
            style={{ maxHeight: '22mm', maxWidth: '55mm', objectFit: 'contain' }}
          />
        </div>

        {/* Infos entreprise */}
        <div className="pdf-company-info">
          <span className="pdf-company-name">{parametres.nom_entreprise}</span>
          {parametres.adresse_entreprise && <span>{parametres.adresse_entreprise}<br /></span>}
          {parametres.telephone_entreprise && <span>Tél : {parametres.telephone_entreprise}<br /></span>}
          {parametres.email_entreprise && <span>{parametres.email_entreprise}<br /></span>}
          <span style={{ fontSize: '7.5pt', color: '#94a3b8' }}>SIRET : {parametres.siret}</span>
        </div>
      </div>

      {/* ── TITRE DU DOCUMENT ────────────────────────────────── */}
      <div className="pdf-title-section">
        <div>
          <div className="pdf-doc-title">{titre}</div>
          <div className="pdf-doc-number">N° {document.numero}</div>
          <div style={{ marginTop: '2mm' }}>
            <span className={`pdf-statut-badge ${statut.cls}`}>{statut.label}</span>
          </div>
        </div>
        <div className="pdf-doc-meta">
          <div><strong>Date d'émission</strong><br />{dateEmission}</div>
          {dateEcheance && (
            <div style={{ marginTop: '2mm' }}>
              <strong>{isDevisDoc ? 'Valable jusqu\'au' : 'Date d\'échéance'}</strong>
              <br />{dateEcheance}
            </div>
          )}
          {!isDevisDoc && (document as Facture).date_paiement && (
            <div style={{ marginTop: '2mm', color: '#065f46', fontWeight: 700 }}>
              ✓ Payé le {formatDateLong((document as Facture).date_paiement)}
            </div>
          )}
        </div>
      </div>

      {/* ── ADRESSES ────────────────────────────────────────── */}
      <div className="pdf-addresses">
        {/* Émetteur */}
        <div className="pdf-address-block">
          <div className="pdf-address-label">Prestataire</div>
          <div className="pdf-address-name">{parametres.nom_entreprise}</div>
          <div className="pdf-address-detail">
            {parametres.adresse_entreprise && <>{parametres.adresse_entreprise}<br /></>}
            {parametres.telephone_entreprise && <>Tél : {parametres.telephone_entreprise}<br /></>}
            {parametres.email_entreprise && <>{parametres.email_entreprise}<br /></>}
            SIRET : {parametres.siret}
          </div>
        </div>

        {/* Client */}
        <div className="pdf-address-block">
          <div className="pdf-address-label">Client</div>
          <div className="pdf-address-name">{client?.nom ?? '—'}</div>
          <div className="pdf-address-detail">
            {client?.adresse && <>{client.adresse}<br /></>}
            {(client?.code_postal || client?.ville) && (
              <>{[client.code_postal, client.ville].filter(Boolean).join(' ')}<br /></>
            )}
            {client?.telephone && <>Tél : {client.telephone}<br /></>}
            {client?.email && <>{client.email}</>}
          </div>
        </div>
      </div>

      {/* ── TABLEAU DES PRESTATIONS ──────────────────────────── */}
      <table className="pdf-table pdf-no-break">
        <thead>
          <tr>
            <th style={{ width: '45%' }}>Description</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Qté</th>
            <th style={{ width: '13%', textAlign: 'center' }}>Unité</th>
            <th style={{ width: '15%', textAlign: 'right' }}>Prix unit. HT</th>
            <th style={{ width: '15%', textAlign: 'right' }}>Montant HT</th>
          </tr>
        </thead>
        <tbody>
          {lignes.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '5mm' }}>
                Aucune prestation
              </td>
            </tr>
          ) : (
            lignes
              .sort((a, b) => a.ordre - b.ordre)
              .map((l, i) => (
                <tr key={l.id ?? i}>
                  <td>
                    <div className="desc-main">{l.description}</div>
                    {l.detail && <div className="desc-detail">{l.detail}</div>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{l.quantite}</td>
                  <td style={{ textAlign: 'center' }}>{l.unite}</td>
                  <td style={{ textAlign: 'right' }}>{formatEuros(l.prix_unitaire)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatEuros(l.montant_ligne)}</td>
                </tr>
              ))
          )}
        </tbody>
      </table>

      {/* ── TOTAUX ───────────────────────────────────────────── */}
      <div className="pdf-totals">
        <div className="pdf-totals-table">
          <div className="pdf-totals-row">
            <span>Total HT</span>
            <span>{formatEuros(total)}</span>
          </div>
          <div className="pdf-totals-row">
            <span>TVA</span>
            <span>0,00 €</span>
          </div>
          <div className="pdf-totals-row total">
            <span>TOTAL TTC</span>
            <span>{formatEuros(total)}</span>
          </div>
          <div className="pdf-tva-mention">TVA non applicable — Art. 293 B du CGI</div>
        </div>
      </div>

      {/* ── NOTES CLIENT ─────────────────────────────────────── */}
      {document.notes_client && (
        <div className="pdf-notes">
          <div className="pdf-notes-label">Informations complémentaires</div>
          {document.notes_client}
        </div>
      )}

      {/* ── SECTION SIGNATURE (devis uniquement) ─────────────── */}
      {isDevisDoc && (
        <div className="pdf-signature-section pdf-no-break">
          {/* Bon pour accord */}
          <div className="pdf-acceptance-box">
            <div className="box-title">Bon pour accord client</div>
            <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '2mm' }}>
              En signant ce document, le client accepte les conditions de la prestation.
            </div>
            <div className="pdf-acceptance-checkbox">
              <div className="pdf-checkbox-square" />
              <span>Lu et approuvé — Signature précédée de la mention «&nbsp;Bon pour accord&nbsp;»</span>
            </div>
            <div style={{ marginTop: '8mm', borderBottom: '1px solid #e2e8f0', width: '40mm' }} />
            <div style={{ fontSize: '7pt', color: '#94a3b8', marginTop: '1mm' }}>Signature client</div>
            <div style={{ marginTop: '3mm', fontSize: '8pt', color: '#94a3b8' }}>
              Date : _____ / _____ / _______
            </div>
          </div>

          {/* Signature prestataire */}
          <div className="pdf-signature-block">
            <div className="pdf-signature-label">Signature du prestataire</div>
            {parametres.signature_url ? (
              <img src={parametres.signature_url} alt="Signature" className="pdf-signature-img" />
            ) : (
              <div className="pdf-signature-placeholder" />
            )}
            <div style={{ fontSize: '8pt', color: '#475569', marginTop: '2mm', fontWeight: 600 }}>
              {parametres.nom_entreprise}
            </div>
          </div>
        </div>
      )}

      {/* ── MENTION PAIEMENT (facture uniquement) ────────────── */}
      {!isDevisDoc && (
        <div className="pdf-notes pdf-no-break" style={{ background: '#f0fdf4', borderColor: '#16a34a' }}>
          <div className="pdf-notes-label" style={{ color: '#15803d' }}>Conditions de règlement</div>
          <div style={{ color: '#166534', fontSize: '8pt', lineHeight: '1.5' }}>
            Règlement par virement bancaire ou chèque à l'ordre de <strong>{parametres.nom_entreprise}</strong>.{' '}
            {(document as Facture).date_echeance && (
              <>Date d'échéance : <strong>{new Date((document as Facture).date_echeance!).toLocaleDateString('fr-FR')}</strong>. </>
            )}
            <br />
            En cas de retard de paiement, une pénalité de <strong>3 fois le taux d'intérêt légal</strong> sera appliquée,
            ainsi qu'une indemnité forfaitaire de recouvrement de <strong>40 €</strong> (art. L441-10 du Code de commerce).
            Aucun escompte pour paiement anticipé.
          </div>
        </div>
      )}

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <div className="pdf-footer">

        {/* Encart Avis Google — affichage conditionnel */}
        {(type === 'devis' ? parametres.afficher_avis_sur_devis : parametres.afficher_avis_sur_factures) && (
          <div className="pdf-google-reviews">
            <div className="pdf-google-logo" aria-label="Google">
              <span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span>
            </div>
            <div style={{ borderLeft: '1px solid #fde68a', height: '8mm', margin: '0 1mm' }} />
            <div>
              <div className="pdf-stars">{renderStars(parametres.note_google ?? 5)}</div>
              <div className="pdf-google-text">
                <strong>{parametres.note_google ?? '5.0'}/5</strong> · {parametres.nombre_avis_google ?? 0} avis clients
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '7.5pt', color: '#78350f', marginBottom: '1mm' }}>
                Vous êtes satisfait(e) ? Laissez-nous un avis !
              </div>
              {parametres.avis_google_url && (
                <div className="pdf-google-cta">{parametres.avis_google_url}</div>
              )}
            </div>
          </div>
        )}

        {/* Mentions légales */}
        <div className="pdf-legal">
          <strong>{parametres.nom_entreprise}</strong> — SIRET : {parametres.siret}<br />
          {parametres.mentions_legales}
        </div>
      </div>

    </div>
  )
}
