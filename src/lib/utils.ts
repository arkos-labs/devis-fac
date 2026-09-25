import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// ── Nombres décimaux (accepte la virgule française) ──────────
export function parseDecimal(value: string): number {
  const normalized = value.replace(',', '.').trim()
  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : n
}

// ── Formatage monétaire ──────────────────────────────────────
export function formatEuros(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ── Formatage date ───────────────────────────────────────────
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr))
}

// ── Statut → label & couleur ─────────────────────────────────
export const STATUT_DEVIS_CONFIG = {
  en_attente: { label: 'En attente',  color: 'amber' },
  accepte:    { label: 'Accepté',     color: 'green'  },
  refuse:     { label: 'Refusé',      color: 'red'    },
  expire:     { label: 'Expiré',      color: 'gray'   },
} as const

export const STATUT_FACTURE_CONFIG = {
  en_attente: { label: 'En attente', color: 'amber' },
  payee:      { label: 'Payée',      color: 'green' },
  retard:     { label: 'En retard',  color: 'red'   },
  annulee:    { label: 'Annulée',    color: 'gray'  },
} as const

export const MOYEN_PAIEMENT_LABEL = {
  virement: 'Virement bancaire',
  cheque:   'Chèque',
  especes:  'Espèces',
  carte:    'Carte bancaire',
  autre:    'Autre',
} as const

// ── Initiales ────────────────────────────────────────────────
export function getInitiales(nom: string): string {
  return nom
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ── Étoiles Google ───────────────────────────────────────────
export function formatStars(note: number): string {
  const full = Math.floor(note)
  const stars = '★'.repeat(full) + '☆'.repeat(5 - full)
  return stars
}
