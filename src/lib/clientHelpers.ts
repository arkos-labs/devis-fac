import type { Client, ClientType } from '@/types/database'

/**
 * Retourne le libellé français du type de client
 */
export function getClientTypeLabel(type: ClientType | string): string {
  const map: Record<string, string> = {
    professionnel: 'Professionnel',
    particulier: 'Particulier'
  }
  return map[type] ?? 'Inconnu'
}

/**
 * Retourne le nom d'affichage du client selon son type
 * Pro : company_name
 * Particulier : Civilité Prénom Nom
 */
export function getClientDisplayName(client: Partial<Client> | null | undefined): string {
  if (!client) return '—'

  if (client.type === 'professionnel') {
    return client.company_name || client.nom || '—'
  } else {
    let display = ''
    if (client.civility) {
      display += client.civility + ' '
    }
    if (client.first_name && client.last_name) {
      display += client.first_name + ' ' + client.last_name
    } else if (client.nom) {
      display += client.nom
    } else {
      display = '—'
    }
    return display.trim()
  }
}

/**
 * Retourne les mentions légales selon le type de client
 */
export function getClientLegalNotices(client: Partial<Client> | null | undefined): string {
  if (!client || client.type !== 'particulier') {
    return ''
  }

  let notices =
    'Garantie légale de conformité : Article L217-3 et suivants du Code de la consommation (durée 2 ans minimum). ' +
    'Garantie des vices cachés : Articles 1641 et suivants du Code civil. '

  if (client.is_canvassing) {
    notices +=
      'Droit de rétractation : 14 jours à compter de la conclusion du contrat ' +
      '(Article L221-18 du Code de la consommation).'
  }

  return notices.trim()
}

/**
 * Retourne les informations à afficher dans le bloc "Client" du PDF
 * Format adapté selon le type (pro vs particulier)
 */
export function formatClientIdentity(client: Partial<Client> | null | undefined): {
  name: string
  address: string
  identifier: string // SIREN pour pro, rien pour particulier
  extras: string[] // TVA, etc.
} {
  if (!client) {
    return { name: '—', address: '—', identifier: '', extras: [] }
  }

  const address = [client.adresse, client.code_postal, client.ville].filter(Boolean).join(' ')

  if (client.type === 'professionnel') {
    return {
      name: client.company_name || client.nom || '—',
      address,
      identifier: client.siren || '',
      extras: client.vat_number ? [`TVA : ${client.vat_number}`] : []
    }
  } else {
    return {
      name: getClientDisplayName(client),
      address,
      identifier: '',
      extras: []
    }
  }
}

/**
 * Retourne les conditions de paiement textuelle selon le type
 */
export function getPaymentTermsText(client: Partial<Client> | null | undefined): string {
  if (!client) return 'Paiement à effectuer selon les conditions convenues.'

  if (client.type === 'professionnel') {
    return (
      'Conditions de paiement : Paiement sous 30 jours de la facture. ' +
      'En cas de retard de paiement, des pénalités s\'ajouteront conformément aux articles L441-6 et L441-3.1 du Code de commerce. ' +
      'Indemnité forfaitaire de 40 € en cas de impayé.'
    )
  } else {
    return 'Paiement à effectuer selon les modalités convenues.'
  }
}

/**
 * Extrait les initiales du nom du client pour l'avatar
 */
export function getClientInitials(client: Partial<Client> | null | undefined): string {
  if (!client) return '?'

  if (client.type === 'professionnel') {
    const name = client.company_name || client.nom || ''
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase())
      .join('')
  } else {
    const initials = [client.first_name?.[0], client.last_name?.[0]]
      .filter(Boolean)
      .map(c => c?.toUpperCase())
      .join('')
    return initials || (client.nom ? client.nom[0]?.toUpperCase() : '?')
  }
}

/**
 * Vérifie si un client est complètement rempli
 */
export function isClientComplete(client: Partial<Client> | null | undefined): boolean {
  if (!client || !client.type) return false

  const commonFields = client.adresse && client.code_postal && client.ville && client.email
  if (!commonFields) return false

  if (client.type === 'professionnel') {
    return !!(client.company_name && client.siren)
  } else {
    return !!(client.first_name && client.last_name)
  }
}

/**
 * Retourne une description courte du client pour les listes
 */
export function getClientSummary(client: Partial<Client> | null | undefined): string {
  if (!client) return '—'

  const parts: string[] = []
  const name = getClientDisplayName(client)
  parts.push(name)

  const type = getClientTypeLabel(client.type || 'particulier')
  parts.push(`(${type})`)

  if (client.email) {
    parts.push(`· ${client.email}`)
  }

  return parts.join(' ')
}
