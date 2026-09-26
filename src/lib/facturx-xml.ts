// ============================================================
// GÉNÉRATEUR XML CII — Factur-X profil BASIC (EN16931)
// Norme utilisée pour la facturation électronique française.
// Référence : FNFE-MPE / Factur-X 1.0.7, profil BASIC.
// ============================================================
import type { Facture, LignePrestation, Client, ParametresCompte } from '@/types/database'

function esc(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Format UN/CEFACT 102 : YYYYMMDD
function toDate102(iso: string): string {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

export interface FacturXInput {
  facture: Facture
  lignes: LignePrestation[]
  client: Client
  parametres: ParametresCompte
}

/**
 * Génère le XML CII (Cross Industry Invoice) conforme au profil BASIC de
 * Factur-X. Ce XML est destiné à être embarqué dans le PDF final (PDF/A-3).
 * Ne s'applique qu'aux factures (les devis n'ont pas de valeur légale
 * de facture électronique).
 */
export function generateFacturXXml({ facture, lignes, client, parametres }: FacturXInput): string {
  const isProfessionnel = client.type_client === 'professionnel'
  const tauxTva = parametres.assujetti_tva ? parametres.taux_tva : 0
  const totalHT = lignes.reduce((s, l) => s + l.montant_ligne, 0)
  const totalTVA = parametres.assujetti_tva ? totalHT * (tauxTva / 100) : 0
  const totalTTC = totalHT + totalTVA

  const categorieTva = parametres.assujetti_tva ? 'S' : 'E'
  const motifExoneration = parametres.assujetti_tva
    ? ''
    : `<ram:ExemptionReason>Franchise en base de TVA, article 293 B du CGI - TVA non applicable</ram:ExemptionReason>
        <ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>`

  const lignesXml = lignes.map((l, i) => `
      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${i + 1}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:Name>${esc(l.description)}</ram:Name>
          ${l.detail ? `<ram:Description>${esc(l.detail)}</ram:Description>` : ''}
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice>
            <ram:ChargeAmount>${money(l.prix_unitaire)}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="${l.unite === 'forfait' ? 'C62' : 'C62'}">${l.quantite}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>${categorieTva}</ram:CategoryCode>
            <ram:RateApplicablePercent>${money(tauxTva)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${money(l.montant_ligne)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`).join('')

  const sellerLegalOrg = `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(parametres.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>`

  const sellerTaxReg = parametres.tva_intracommunautaire ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(parametres.tva_intracommunautaire)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''

  const buyerLegalOrg = isProfessionnel && client.siret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(client.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''

  const buyerTaxReg = isProfessionnel && client.tva_intracommunautaire ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(client.tva_intracommunautaire)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''

  const buyerName = isProfessionnel && client.nom_entreprise ? client.nom_entreprise : client.nom

  const paymentMeans = parametres.iban ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(parametres.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        ${parametres.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(parametres.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''

  const dateEcheance = facture.date_echeance ? toDate102(facture.date_echeance) : toDate102(facture.date_creation)

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(facture.numero)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${toDate102(facture.date_creation)}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${facture.titre ? `<ram:IncludedNote><ram:Content>${esc(facture.titre)}</ram:Content></ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lignesXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(parametres.nom_entreprise)}</ram:Name>${sellerLegalOrg}
        <ram:PostalTradeAddress>
          <ram:CountryID>${esc(parametres.code_pays) || 'FR'}</ram:CountryID>
        </ram:PostalTradeAddress>${sellerTaxReg}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(buyerName)}</ram:Name>${buyerLegalOrg}
        <ram:PostalTradeAddress>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${buyerTaxReg}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${paymentMeans}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${money(totalTVA)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${money(totalHT)}</ram:BasisAmount>
        <ram:CategoryCode>${categorieTva}</ram:CategoryCode>${motifExoneration}
        <ram:RateApplicablePercent>${money(tauxTva)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dateEcheance}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${money(totalHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${money(totalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${money(totalTVA)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${money(totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${money(totalTTC)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}
