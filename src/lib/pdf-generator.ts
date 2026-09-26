// ============================================================
// GÉNÉRATEUR PDF (texte vectoriel, pas une image) via pdf-lib
// Utilisé pour les devis (PDF simple) et factures (base du PDF
// Factur-X avant embarquement du XML).
// ============================================================
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Devis, Facture, LignePrestation, Client, ParametresCompte } from '@/types/database'
import { formatEuros, formatDateLong } from '@/lib/utils'

const PAGE_W = 595.28 // A4 pt
const PAGE_H = 841.89
const MARGIN = 50

interface Ctx {
  doc: PDFDocument
  page: PDFPage
  font: PDFFont
  fontBold: PDFFont
  y: number
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H])
  ctx.y = PAGE_H - MARGIN
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) newPage(ctx)
}

// La police standard (WinAnsi) ne couvre que Latin-1 : on retire les emojis/symboles
// exotiques que des champs libres (notes, mentions légales...) pourraient contenir,
// plutôt que de planter la génération du PDF.
function sanitizeForPdf(str: string): string {
  return Array.from(str).map(ch => (ch.codePointAt(0)! <= 0xff ? ch : '')).join('')
}

function text(ctx: Ctx, str: string, x: number, size = 10, bold = false, color = rgb(0.1, 0.1, 0.12)) {
  ctx.page.drawText(sanitizeForPdf(str), { x, y: ctx.y, size, font: bold ? ctx.fontBold : ctx.font, color })
}

// Étoile 5 branches (path SVG, centrée sur 0,0, rayon ~10)
const STAR_PATH = 'M0,-10 L2.35,-3.09 L9.51,-3.09 L3.7,1.18 L5.88,8.09 L0,3.82 L-5.88,8.09 L-3.7,1.18 L-9.51,-3.09 L-2.35,-3.09 Z'

function drawStar(ctx: Ctx, x: number, y: number, size: number, filled: boolean) {
  ctx.page.drawSvgPath(STAR_PATH, {
    x, y,
    scale: size / 10,
    color: filled ? rgb(0.96, 0.62, 0.04) : rgb(0.88, 0.88, 0.9),
    borderWidth: 0,
  })
}

function line(ctx: Ctx, x1: number, x2: number, color = rgb(0.85, 0.85, 0.87)) {
  ctx.page.drawLine({ start: { x: x1, y: ctx.y }, end: { x: x2, y: ctx.y }, thickness: 0.75, color })
}

export interface PdfGenInput {
  document: Devis | Facture
  type: 'devis' | 'facture'
  lignes: LignePrestation[]
  client: Client
  parametres: ParametresCompte
}

// Télécharge et embarque le logo (PNG ou JPEG) dans le PDF. Retourne null
// si l'URL est absente ou le format non supporté, pour ne jamais bloquer
// la génération du document.
async function embedImage(doc: PDFDocument, url: string | null) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('png') || url.toLowerCase().endsWith('.png')) {
      return await doc.embedPng(bytes)
    }
    return await doc.embedJpg(bytes)
  } catch {
    return null
  }
}

export async function generateDocumentPdf({ document, type, lignes, client, parametres }: PdfGenInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), font, fontBold, y: PAGE_H - MARGIN }

  const isDevis = type === 'devis'
  const titre = isDevis ? 'DEVIS' : 'FACTURE'

  // ── En-tête ──────────────────────────────────────────────
  const logo = await embedImage(doc, parametres.logo_url)
  if (logo) {
    const maxH = 90
    const maxW = 260
    const scale = Math.min(maxH / logo.height, maxW / logo.width)
    const w = logo.width * scale
    const h = logo.height * scale
    ctx.page.drawImage(logo, { x: MARGIN, y: ctx.y - h, width: w, height: h })
    ctx.y -= h + 10
  } else {
    text(ctx, parametres.nom_entreprise, MARGIN, 16, true)
    ctx.y -= 22
  }
  text(ctx, titre, MARGIN, 22, true, rgb(0.09, 0.25, 0.55))
  text(ctx, `N° ${document.numero}`, PAGE_W - MARGIN - 150, 11, true)
  ctx.y -= 16
  text(ctx, `Date d'émission : ${formatDateLong(document.date_creation)}`, PAGE_W - MARGIN - 220, 9)
  ctx.y -= 14
  const dateFin = isDevis ? (document as Devis).date_validite : (document as Facture).date_echeance
  if (dateFin) {
    text(ctx, `${isDevis ? 'Validité' : 'Échéance'} : ${formatDateLong(dateFin)}`, PAGE_W - MARGIN - 220, 9)
  }
  ctx.y -= 26
  line(ctx, MARGIN, PAGE_W - MARGIN, rgb(0.1, 0.1, 0.12))
  ctx.y -= 24

  // ── Émetteur / Client ────────────────────────────────────
  const colW = (PAGE_W - MARGIN * 2 - 20) / 2
  const startY = ctx.y
  text(ctx, 'ÉMETTEUR', MARGIN, 9, true, rgb(0.4, 0.4, 0.45))
  ctx.y -= 14
  text(ctx, parametres.nom_entreprise, MARGIN, 10, true)
  ctx.y -= 13
  if (parametres.forme_juridique) { text(ctx, parametres.forme_juridique, MARGIN, 9); ctx.y -= 12 }
  if (parametres.adresse_entreprise) { text(ctx, parametres.adresse_entreprise, MARGIN, 9); ctx.y -= 12 }
  text(ctx, `SIRET : ${parametres.siret}`, MARGIN, 9); ctx.y -= 12
  if (parametres.tva_intracommunautaire) { text(ctx, `TVA intra. : ${parametres.tva_intracommunautaire}`, MARGIN, 9); ctx.y -= 12 }
  if (parametres.email_entreprise) { text(ctx, parametres.email_entreprise, MARGIN, 9); ctx.y -= 12 }
  if (parametres.telephone_entreprise) { text(ctx, parametres.telephone_entreprise, MARGIN, 9); ctx.y -= 12 }
  const emetteurEndY = ctx.y

  ctx.y = startY
  const colX = MARGIN + colW + 20
  text(ctx, isDevis ? 'ADRESSÉ À' : 'FACTURÉ À', colX, 9, true, rgb(0.4, 0.4, 0.45))
  ctx.y -= 14
  const buyerName = client.type_client === 'professionnel' && client.nom_entreprise ? client.nom_entreprise : client.nom
  text(ctx, buyerName, colX, 10, true)
  ctx.y -= 13
  if (client.type_client === 'professionnel' && client.nom_entreprise) { text(ctx, client.nom, colX, 9); ctx.y -= 12 }
  if (client.adresse) { text(ctx, client.adresse, colX, 9); ctx.y -= 12 }
  if (client.code_postal || client.ville) { text(ctx, [client.code_postal, client.ville].filter(Boolean).join(' '), colX, 9); ctx.y -= 12 }
  if (client.siret) { text(ctx, `SIRET : ${client.siret}`, colX, 9); ctx.y -= 12 }
  if (client.tva_intracommunautaire) { text(ctx, `TVA intra. : ${client.tva_intracommunautaire}`, colX, 9); ctx.y -= 12 }
  if (client.email) { text(ctx, client.email, colX, 9); ctx.y -= 12 }

  ctx.y = Math.min(emetteurEndY, ctx.y) - 20
  line(ctx, MARGIN, PAGE_W - MARGIN)
  ctx.y -= 20

  // ── Tableau des prestations ──────────────────────────────
  const colDesc = MARGIN
  const colQte = PAGE_W - MARGIN - 220
  const colPu = PAGE_W - MARGIN - 140
  const colTotal = PAGE_W - MARGIN - 60

  text(ctx, 'Description', colDesc, 9, true, rgb(0.4, 0.4, 0.45))
  text(ctx, 'Qté', colQte, 9, true, rgb(0.4, 0.4, 0.45))
  text(ctx, 'PU HT', colPu, 9, true, rgb(0.4, 0.4, 0.45))
  text(ctx, 'Total HT', colTotal, 9, true, rgb(0.4, 0.4, 0.45))
  ctx.y -= 8
  line(ctx, MARGIN, PAGE_W - MARGIN, rgb(0.1, 0.1, 0.12))
  ctx.y -= 16

  let totalHT = 0
  for (const l of [...lignes].sort((a, b) => a.ordre - b.ordre)) {
    ensureSpace(ctx, 40)
    totalHT += l.montant_ligne
    text(ctx, l.description, colDesc, 10, true)
    text(ctx, `${l.quantite} ${l.unite !== 'forfait' ? l.unite : ''}`.trim(), colQte, 9)
    text(ctx, formatEuros(l.prix_unitaire), colPu, 9)
    text(ctx, formatEuros(l.montant_ligne), colTotal, 9, true)
    ctx.y -= 13
    if (l.detail) {
      ensureSpace(ctx, 20)
      text(ctx, l.detail, colDesc, 8, false, rgb(0.45, 0.45, 0.5))
      ctx.y -= 14
    }
    ctx.y -= 6
    line(ctx, MARGIN, PAGE_W - MARGIN)
    ctx.y -= 14
  }

  // ── Totaux ────────────────────────────────────────────────
  ensureSpace(ctx, 90)
  const assujetti = parametres.assujetti_tva
  const tauxTva = assujetti ? parametres.taux_tva : 0
  const totalTVA = assujetti ? totalHT * (tauxTva / 100) : 0
  const totalTTC = totalHT + totalTVA

  const totX = PAGE_W - MARGIN - 180
  text(ctx, 'Total HT', totX, 10); text(ctx, formatEuros(totalHT), colTotal, 10, true)
  ctx.y -= 16
  text(ctx, `TVA${assujetti ? ` (${tauxTva}%)` : ''}`, totX, 10)
  text(ctx, assujetti ? formatEuros(totalTVA) : '0,00 €', colTotal, 10, true)
  ctx.y -= 16
  line(ctx, totX, PAGE_W - MARGIN, rgb(0.1, 0.1, 0.12))
  ctx.y -= 16
  text(ctx, 'TOTAL TTC', totX, 12, true)
  text(ctx, formatEuros(totalTTC), colTotal, 12, true)
  ctx.y -= 14
  if (!assujetti) {
    text(ctx, 'TVA non applicable, art. 293 B du CGI', totX, 8, false, rgb(0.5, 0.5, 0.55))
    ctx.y -= 12
  }

  // ── Mentions légales / paiement ──────────────────────────
  ensureSpace(ctx, 100)
  ctx.y -= 16
  line(ctx, MARGIN, PAGE_W - MARGIN)
  ctx.y -= 20

  if (!isDevis) {
    text(ctx, 'RÈGLEMENT', MARGIN, 9, true, rgb(0.4, 0.4, 0.45))
    ctx.y -= 14
    const f = document as Facture
    text(ctx, `Échéance : ${f.date_echeance ? formatDateLong(f.date_echeance) : 'À réception'}`, MARGIN, 9)
    ctx.y -= 12
    if (parametres.iban) {
      text(ctx, `IBAN : ${parametres.iban}`, MARGIN, 9)
      ctx.y -= 12
    }
    if (parametres.bic) {
      text(ctx, `BIC : ${parametres.bic}`, MARGIN, 9)
      ctx.y -= 12
    }
    ctx.y -= 8
    text(ctx, `Pénalités de retard : ${f.taux_penalites_retard ?? 12}% par an. Indemnité forfaitaire de recouvrement : ${formatEuros(f.indemnite_recouvrement ?? 40)}.`, MARGIN, 8, false, rgb(0.5, 0.5, 0.55))
    ctx.y -= 12
    text(ctx, "Pas d'escompte pour paiement anticipé.", MARGIN, 8, false, rgb(0.5, 0.5, 0.55))
    ctx.y -= 16
  } else {
    text(ctx, "Bon pour accord, précédé de la mention manuscrite, daté et signé :", MARGIN, 9, false, rgb(0.5, 0.5, 0.55))
    ctx.y -= 40
  }

  // ── Signature du prestataire ──────────────────────────────
  ensureSpace(ctx, 70)
  const signature = await embedImage(doc, parametres.signature_url)
  const sigX = PAGE_W - MARGIN - 120
  text(ctx, 'Le Prestataire', sigX, 8, true, rgb(0.6, 0.6, 0.65))
  ctx.y -= 10
  if (signature) {
    const maxH = 40
    const scale = Math.min(maxH / signature.height, 120 / signature.width)
    const w = signature.width * scale
    const h = signature.height * scale
    ctx.page.drawImage(signature, { x: PAGE_W - MARGIN - w, y: ctx.y - h, width: w, height: h })
    ctx.y -= h + 4
  } else {
    ctx.y -= 40
  }
  text(ctx, parametres.nom_entreprise, sigX, 9, true)
  ctx.y -= 20

  if (parametres.mentions_legales) {
    for (const l of parametres.mentions_legales.split('\n').filter(Boolean)) {
      ensureSpace(ctx, 14)
      text(ctx, `• ${l}`, MARGIN, 8, false, rgb(0.5, 0.5, 0.55))
      ctx.y -= 12
    }
  }

  // ── Avis Google ───────────────────────────────────────────
  const showAvis = isDevis ? parametres.afficher_avis_sur_devis !== false : parametres.afficher_avis_sur_factures !== false
  if (showAvis) {
    ensureSpace(ctx, 70)
    ctx.y -= 16
    line(ctx, MARGIN, PAGE_W - MARGIN)
    ctx.y -= 24
    const docAvisNote = (document as unknown as { note_google_snapshot?: number }).note_google_snapshot ?? parametres.note_google ?? 5
    const docAvisCount = (document as unknown as { nombre_avis_google_snapshot?: number }).nombre_avis_google_snapshot ?? parametres.nombre_avis_google ?? 0
    const centerX = PAGE_W / 2
    const filledStars = Math.round(Number(docAvisNote) || 0)
    text(ctx, 'Avis Google', centerX - 40, 11, true, rgb(0.2, 0.2, 0.25))
    ctx.y -= 18
    const starSize = 6
    const starGap = 15
    const starsStartX = centerX - 40
    for (let i = 0; i < 5; i++) {
      drawStar(ctx, starsStartX + i * starGap + starSize, ctx.y, starSize, i < filledStars)
    }
    ctx.y -= 18
    text(ctx, `${docAvisNote}/5 sur ${docAvisCount} avis`, centerX - 40, 9, false, rgb(0.4, 0.4, 0.45))
    ctx.y -= 16
    if (parametres.avis_google_url) {
      text(ctx, 'Satisfait(e) de notre prestation ? Laissez-nous un avis :', MARGIN, 8, false, rgb(0.5, 0.5, 0.55))
      ctx.y -= 12
      text(ctx, parametres.avis_google_url, MARGIN, 8, true, rgb(0.15, 0.35, 0.75))
      ctx.y -= 12
    }
  }

  return doc.save()
}
