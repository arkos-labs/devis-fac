// ============================================================
// ORCHESTRATION FACTUR-X
// Génère le PDF, et pour les factures, embarque le XML CII
// (profil BASIC EN16931) comme pièce jointe conforme PDF/A-3.
// ============================================================
import { PDFDocument, AFRelationship, PDFName } from 'pdf-lib'
import type { Devis, Facture, LignePrestation, Client, ParametresCompte } from '@/types/database'
import { generateDocumentPdf } from '@/lib/pdf-generator'
import { generateFacturXXml } from '@/lib/facturx-xml'

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Métadonnées XMP requises par la spécification Factur-X/ZUGFeRD (schéma
// fx:) et par l'identification PDF/A (schéma pdfaid:), lues par les
// logiciels comptables pour détecter et valider la facture électronique
// embarquée. Ceci ne suffit pas, à lui seul, à garantir une conformité
// PDF/A-3 totale (qui exige aussi un profil ICC et des polices embarquées
// vérifiées) — voir le commentaire au-dessus de generateDownloadableDocument.
function buildFacturXMetadataXml(facture: Facture, parametres: ParametresCompte): string {
  const title = esc(`Facture ${facture.numero}`)
  const creator = esc(parametres.nom_entreprise)
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
    xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
   <pdfaid:part>3</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li></rdf:Seq></dc:creator>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">Facture electronique Factur-X, profil BASIC (EN16931)</rdf:li></rdf:Alt></dc:description>
   <xmp:CreatorTool>CleanPro CRM</xmp:CreatorTool>
   <pdf:Producer>CleanPro CRM</pdf:Producer>
   <fx:DocumentType>INVOICE</fx:DocumentType>
   <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
   <fx:Version>1.0</fx:Version>
   <fx:ConformanceLevel>BASIC</fx:ConformanceLevel>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

export interface GenerateInput {
  document: Devis | Facture
  type: 'devis' | 'facture'
  lignes: LignePrestation[]
  client: Client
  parametres: ParametresCompte
}

export interface GenerateResult {
  blob: Blob
  filename: string
  isFacturX: boolean
}

/**
 * Génère le fichier téléchargeable :
 * - Devis  → PDF simple
 * - Facture → Factur-X : XML CII embarqué (profil BASIC EN16931) + métadonnées
 *   XMP déclarant la conformité PDF/A-3 et le schéma Factur-X (fx:), lues par
 *   les logiciels comptables pour détecter la facture électronique.
 *   Limite connue : pdf-lib ne génère pas de PDF/A-3 pleinement validé au
 *   sens ISO 19005-3 (il manque le profil ICC de sortie et l'embarquement
 *   garanti des polices) — à valider avec un outil dédié (ex. veraPDF) avant
 *   de s'appuyer dessus pour une obligation réglementaire stricte.
 */
export async function generateDownloadableDocument({ document, type, lignes, client, parametres }: GenerateInput): Promise<GenerateResult> {
  const pdfBytes = await generateDocumentPdf({ document, type, lignes, client, parametres })

  if (type === 'devis') {
    return {
      blob: new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }),
      filename: `${document.numero}.pdf`,
      isFacturX: false,
    }
  }

  // ── Facture : embarquer le XML CII dans le PDF (Factur-X) ──
  const xml = generateFacturXXml({ facture: document as Facture, lignes, client, parametres })
  const pdfDoc = await PDFDocument.load(pdfBytes)

  pdfDoc.setTitle(`Facture ${document.numero}`)
  pdfDoc.setSubject('Facture électronique Factur-X (profil BASIC, EN16931)')
  pdfDoc.setKeywords(['Factur-X', 'facture électronique', 'EN16931'])
  pdfDoc.setProducer('CleanPro CRM')

  const xmlBytes = new TextEncoder().encode(xml)
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Facture électronique structurée Factur-X (CII, profil BASIC EN16931)',
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Data,
  })

  // Métadonnées XMP (PDF/A id + schéma Factur-X). Non bloquant : si
  // l'embarquement échoue pour une raison quelconque, la facture reste
  // valide et téléchargeable, juste sans ce niveau de métadonnées.
  try {
    const xmpXml = buildFacturXMetadataXml(document as Facture, parametres)
    const metadataStream = pdfDoc.context.stream(new TextEncoder().encode(xmpXml), {
      Type: 'Metadata',
      Subtype: 'XML',
    })
    const metadataRef = pdfDoc.context.register(metadataStream)
    pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef)
  } catch {
    // best-effort : on ignore, le PDF/XML reste valide sans ces métadonnées
  }

  const finalBytes = await pdfDoc.save()
  return {
    blob: new Blob([finalBytes as BlobPart], { type: 'application/pdf' }),
    filename: `${document.numero}.pdf`,
    isFacturX: true,
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  a.href = url
  a.download = filename
  window.document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
