import type { ClientType, Civility } from '@/types/database'

// ============================================================
// FORMULAIRE DE CLIENT
// ============================================================
export interface ClientFormData {
  type: ClientType
  // Champs communs
  email: string
  telephone: string
  adresse: string
  ville: string
  code_postal: string
  notes: string
  country: string
  // Champs PROFESSIONNEL
  company_name: string
  siren: string
  siret: string
  vat_number: string
  legal_form: string
  contact_name: string
  service_address: string
  // Champs PARTICULIER
  first_name: string
  last_name: string
  civility: Civility | ''
  is_canvassing: boolean
}

// ============================================================
// ERREURS DE VALIDATION
// ============================================================
export interface ValidationError {
  field: keyof ClientFormData
  message: string
}

// ============================================================
// VALIDATIONS UNITAIRES
// ============================================================

function validateEmail(email: string | null | undefined): boolean {
  if (!email) return true // Optionnel
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateSiren(siren: string | null | undefined): boolean {
  if (!siren) return true // Optionnel pour cette validation simple
  if (!/^\d{9}$/.test(siren)) return false
  // Validation LUHN (optionnel côté client, vérifié au serveur)
  return validateLuhnSiren(siren)
}

function validateSiret(siret: string | null | undefined): boolean {
  if (!siret) return true // Optionnel
  return /^\d{14}$/.test(siret)
}

function validateVatNumber(vat: string | null | undefined): boolean {
  if (!vat) return true // Optionnel
  return /^FR\d{11}$/.test(vat)
}

/**
 * Validation Luhn pour SIREN (9 chiffres)
 * Algorithme : doubler les chiffres de rang impair (1-indexed),
 * si >= 10 soustraire 9, sommer tous, la clé est (10 - (somme % 10)) % 10
 */
export function validateLuhnSiren(siren: string): boolean {
  if (!/^\d{9}$/.test(siren)) return false

  let sum = 0
  for (let i = 0; i < 8; i++) {
    let digit = parseInt(siren[i], 10)
    if (i % 2 === 0) {
      digit *= 2
      if (digit >= 10) digit -= 9
    }
    sum += digit
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === parseInt(siren[8], 10)
}

// ============================================================
// VALIDATION GLOBALE
// ============================================================

export function validateClientForm(form: Partial<ClientFormData>): ValidationError[] {
  const errors: ValidationError[] = []

  if (!form.type) {
    errors.push({ field: 'type', message: 'Le type de client est obligatoire' })
    return errors // Arrêter si pas de type
  }

  const type = form.type as ClientType

  // ──── CHAMPS COMMUNS ────────────────────────────────────────
  if (!form.adresse || form.adresse.trim() === '') {
    errors.push({ field: 'adresse', message: 'L\'adresse est obligatoire' })
  }

  if (!form.code_postal || form.code_postal.trim() === '') {
    errors.push({ field: 'code_postal', message: 'Le code postal est obligatoire' })
  } else if (!/^\d{5}$/.test(form.code_postal.trim())) {
    errors.push({ field: 'code_postal', message: 'Le code postal doit contenir 5 chiffres' })
  }

  if (!form.ville || form.ville.trim() === '') {
    errors.push({ field: 'ville', message: 'La ville est obligatoire' })
  }

  if (form.email && !validateEmail(form.email)) {
    errors.push({ field: 'email', message: 'L\'adresse email est invalide' })
  }

  // ──── VALIDATIONS SPÉCIFIQUES AU TYPE ────────────────────────

  if (type === 'professionnel') {
    // Champs obligatoires pour PRO
    if (!form.company_name || form.company_name.trim() === '') {
      errors.push({ field: 'company_name', message: 'La dénomination sociale est obligatoire' })
    } else if (form.company_name.trim().length < 2) {
      errors.push({ field: 'company_name', message: 'La dénomination sociale doit contenir au moins 2 caractères' })
    }

    if (!form.siren || form.siren.trim() === '') {
      errors.push({ field: 'siren', message: 'Le SIREN est obligatoire (exigence légale depuis 2026)' })
    } else if (!validateSiren(form.siren)) {
      errors.push({
        field: 'siren',
        message: 'Le SIREN doit contenir exactement 9 chiffres avec une clé de contrôle valide'
      })
    }

    // Champs optionnels pour PRO
    if (form.siret && !validateSiret(form.siret)) {
      errors.push({
        field: 'siret',
        message: 'Le SIRET doit contenir exactement 14 chiffres'
      })
    }

    if (form.vat_number && !validateVatNumber(form.vat_number)) {
      errors.push({
        field: 'vat_number',
        message: 'Le numéro TVA doit être au format FR + 11 chiffres (ex: FR12345678901)'
      })
    }
  } else if (type === 'particulier') {
    // Champs obligatoires pour PARTICULIER
    if (!form.first_name || form.first_name.trim() === '') {
      errors.push({ field: 'first_name', message: 'Le prénom est obligatoire' })
    }

    if (!form.last_name || form.last_name.trim() === '') {
      errors.push({ field: 'last_name', message: 'Le nom est obligatoire' })
    }
  }

  return errors
}

/**
 * Retourne un message d'aide contextuel selon le type de client
 */
export function getClientTypeHelpMessage(type: ClientType | undefined): string {
  if (type === 'professionnel') {
    return '🏢 Le numéro SIREN est obligatoire sur vos factures depuis 2026.'
  } else if (type === 'particulier') {
    return '👤 Aucun numéro d\'identification n\'est requis pour un particulier.'
  }
  return ''
}

/**
 * Retourne les champs visibles selon le type de client
 */
export function getVisibleFieldsForType(): {
  pro: (keyof ClientFormData)[]
  particulier: (keyof ClientFormData)[]
  always: (keyof ClientFormData)[]
} {
  return {
    pro: ['company_name', 'siren', 'siret', 'vat_number', 'legal_form', 'contact_name', 'service_address'],
    particulier: ['first_name', 'last_name', 'civility', 'is_canvassing'],
    always: ['email', 'telephone', 'adresse', 'ville', 'code_postal', 'notes', 'country']
  }
}

/**
 * Réinitialise un formulaire selon le type choisi
 */
export function resetFormByType(type: ClientType): Partial<ClientFormData> {
  const base: Partial<ClientFormData> = {
    type,
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    code_postal: '',
    notes: '',
    country: 'France',
    is_canvassing: false
  }

  if (type === 'professionnel') {
    return {
      ...base,
      company_name: '',
      siren: '',
      siret: '',
      vat_number: '',
      legal_form: '',
      contact_name: '',
      service_address: ''
    }
  } else {
    return {
      ...base,
      first_name: '',
      last_name: '',
      civility: ''
    }
  }
}
