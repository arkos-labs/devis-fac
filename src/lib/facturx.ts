// ============================================================
// ORCHESTRATION FACTUR-X
// Génère le PDF, et pour les factures, embarque le XML CII
// (profil BASIC EN16931) comme pièce jointe conforme PDF/A-3.
// ============================================================
import { PDFDocument, AFRelationship } from 'pdf-lib'
import type { Devis, Facture, LignePrestation, Client, ParametresCompte } from '@/types/database'
import { generateDocumentPdf } from '@/lib/pdf-generator'
import { generateFacturXXml } from '@/lib/facturx-xml'

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
 * - Facture → Factur-X (PDF/A-3 + XML CII embarqué, profil BASIC EN16931)
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
