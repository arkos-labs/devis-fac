import { describe, it, expect } from 'vitest'
import {
  validateClientForm,
  validateLuhnSiren,
  getClientTypeHelpMessage,
  getVisibleFieldsForType,
  resetFormByType
} from './clientValidation'
import type { ClientFormData } from './clientValidation'

// ============================================================
// TESTS : VALIDATION LUHN SIREN
// ============================================================
describe('validateLuhnSiren', () => {
  it('valide un SIREN correct', () => {
    // SIREN exemple valide : 81220670
    expect(validateLuhnSiren('81220670')).toBe(true)
  })

  it('rejette un SIREN avec clé invalide', () => {
    // SIREN invalide (clé fausse)
    expect(validateLuhnSiren('81220671')).toBe(false)
  })

  it('rejette un SIREN trop court', () => {
    expect(validateLuhnSiren('812206')).toBe(false)
  })

  it('rejette un SIREN avec caractères non-numériques', () => {
    expect(validateLuhnSiren('8122067A')).toBe(false)
  })

  it('rejette une chaîne vide', () => {
    expect(validateLuhnSiren('')).toBe(false)
  })
})

// ============================================================
// TESTS : VALIDATION GLOBALE FORMULAIRE
// ============================================================
describe('validateClientForm', () => {
  // ──── VALIDATIONS COMMUNES ────────────────────────────────

  it('rejette si pas de type', () => {
    const form: Partial<ClientFormData> = {}
    const errors = validateClientForm(form)
    expect(errors.some(e => e.field === 'type')).toBe(true)
  })

  it('rejette si adresse manquante', () => {
    const form: Partial<ClientFormData> = {
      type: 'particulier',
      adresse: '',
      code_postal: '75001',
      ville: 'Paris'
    }
    const errors = validateClientForm(form)
    expect(errors.some(e => e.field === 'adresse')).toBe(true)
  })

  it('rejette si code postal manquant', () => {
    const form: Partial<ClientFormData> = {
      type: 'particulier',
      adresse: '123 rue de la Paix',
      code_postal: '',
      ville: 'Paris'
    }
    const errors = validateClientForm(form)
    expect(errors.some(e => e.field === 'code_postal')).toBe(true)
  })

  it('rejette si code postal n\'a pas 5 chiffres', () => {
    const form: Partial<ClientFormData> = {
      type: 'particulier',
      adresse: '123 rue de la Paix',
      code_postal: 'ABC12',
      ville: 'Paris'
    }
    const errors = validateClientForm(form)
    expect(errors.some(e => e.field === 'code_postal')).toBe(true)
  })

  it('rejette si ville manquante', () => {
    const form: Partial<ClientFormData> = {
      type: 'particulier',
      adresse: '123 rue de la Paix',
      code_postal: '75001',
      ville: ''
    }
    const errors = validateClientForm(form)
    expect(errors.some(e => e.field === 'ville')).toBe(true)
  })

  it('rejette email invalide', () => {
    const form: Partial<ClientFormData> = {
      type: 'particulier',
      adresse: '123 rue de la Paix',
      code_postal: '75001',
      ville: 'Paris',
      email: 'email-invalide'
    }
    const errors = validateClientForm(form)
    expect(errors.some(e => e.field === 'email')).toBe(true)
  })

  it('accepte email vide', () => {
    const form: Partial<ClientFormData> = {
      type: 'particulier',
      adresse: '123 rue de la Paix',
      code_postal: '75001',
      ville: 'Paris',
      email: ''
    }
    const errors = validateClientForm(form)
    expect(errors.some(e => e.field === 'email')).toBe(false)
  })

  // ──── VALIDATIONS PROFESSIONNEL ────────────────────────────

  describe('Professionnel', () => {
    it('rejette si company_name manquant', () => {
      const form: Partial<ClientFormData> = {
        type: 'professionnel',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        company_name: '',
        siren: '812206700'
      }
      const errors = validateClientForm(form)
      expect(errors.some(e => e.field === 'company_name')).toBe(true)
    })

    it('rejette si SIREN manquant', () => {
      const form: Partial<ClientFormData> = {
        type: 'professionnel',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        company_name: 'Ma Boite SARL',
        siren: ''
      }
      const errors = validateClientForm(form)
      expect(errors.some(e => e.field === 'siren')).toBe(true)
    })

    it('rejette si SIREN invalide', () => {
      const form: Partial<ClientFormData> = {
        type: 'professionnel',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        company_name: 'Ma Boite SARL',
        siren: '81220671' // Clé Luhn invalide
      }
      const errors = validateClientForm(form)
      expect(errors.some(e => e.field === 'siren')).toBe(true)
    })

    it('rejette SIRET invalide (pas 14 chiffres)', () => {
      const form: Partial<ClientFormData> = {
        type: 'professionnel',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        company_name: 'Ma Boite SARL',
        siren: '81220670',
        siret: '812206700123' // 12 chiffres au lieu de 14
      }
      const errors = validateClientForm(form)
      expect(errors.some(e => e.field === 'siret')).toBe(true)
    })

    it('rejette VAT invalide (pas au format FR)', () => {
      const form: Partial<ClientFormData> = {
        type: 'professionnel',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        company_name: 'Ma Boite SARL',
        siren: '81220670',
        vat_number: 'DE12345678901' // Format allemand
      }
      const errors = validateClientForm(form)
      expect(errors.some(e => e.field === 'vat_number')).toBe(true)
    })

    it('accepte VAT au format correct', () => {
      const form: Partial<ClientFormData> = {
        type: 'professionnel',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        company_name: 'Ma Boite SARL',
        siren: '81220670',
        vat_number: 'FR12345678901'
      }
      const errors = validateClientForm(form)
      expect(errors.some(e => e.field === 'vat_number')).toBe(false)
    })

    it('accepte un professionnel valide', () => {
      const form: Partial<ClientFormData> = {
        type: 'professionnel',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        email: 'contact@example.com',
        company_name: 'Ma Boite SARL',
        siren: '81220670'
      }
      const errors = validateClientForm(form)
      expect(errors.length).toBe(0)
    })
  })

  // ──── VALIDATIONS PARTICULIER ──────────────────────────────

  describe('Particulier', () => {
    it('rejette si first_name manquant', () => {
      const form: Partial<ClientFormData> = {
        type: 'particulier',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        first_name: '',
        last_name: 'Dupont'
      }
      const errors = validateClientForm(form)
      expect(errors.some(e => e.field === 'first_name')).toBe(true)
    })

    it('rejette si last_name manquant', () => {
      const form: Partial<ClientFormData> = {
        type: 'particulier',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        first_name: 'Jean',
        last_name: ''
      }
      const errors = validateClientForm(form)
      expect(errors.some(e => e.field === 'last_name')).toBe(true)
    })

    it('accepte un particulier valide', () => {
      const form: Partial<ClientFormData> = {
        type: 'particulier',
        adresse: '123 rue de la Paix',
        code_postal: '75001',
        ville: 'Paris',
        email: 'jean@example.com',
        first_name: 'Jean',
        last_name: 'Dupont'
      }
      const errors = validateClientForm(form)
      expect(errors.length).toBe(0)
    })
  })
})

// ============================================================
// TESTS : MESSAGES D'AIDE
// ============================================================
describe('getClientTypeHelpMessage', () => {
  it('retourne un message pour professionnel', () => {
    const msg = getClientTypeHelpMessage('professionnel')
    expect(msg).toContain('SIREN')
    expect(msg).toContain('2026')
  })

  it('retourne un message pour particulier', () => {
    const msg = getClientTypeHelpMessage('particulier')
    expect(msg).toContain('Aucun numéro d\'identification')
  })

  it('retourne vide pour type indéfini', () => {
    const msg = getClientTypeHelpMessage(undefined)
    expect(msg).toBe('')
  })
})

// ============================================================
// TESTS : CHAMPS VISIBLES
// ============================================================
describe('getVisibleFieldsForType', () => {
  it('retourne les champs pro et communs', () => {
    const fields = getVisibleFieldsForType('professionnel')
    expect(fields.pro).toContain('siren')
    expect(fields.pro).toContain('company_name')
    expect(fields.always).toContain('adresse')
    expect(fields.particulier).toHaveLength(0)
  })

  it('retourne les champs particulier et communs', () => {
    const fields = getVisibleFieldsForType('particulier')
    expect(fields.particulier).toContain('first_name')
    expect(fields.particulier).toContain('last_name')
    expect(fields.always).toContain('adresse')
    expect(fields.pro).toHaveLength(0)
  })
})

// ============================================================
// TESTS : RESET FORMULAIRE
// ============================================================
describe('resetFormByType', () => {
  it('crée un formulaire pro vide', () => {
    const form = resetFormByType('professionnel')
    expect(form.type).toBe('professionnel')
    expect(form.company_name).toBe('')
    expect(form.siren).toBe('')
    expect(form.first_name).toBeUndefined()
  })

  it('crée un formulaire particulier vide', () => {
    const form = resetFormByType('particulier')
    expect(form.type).toBe('particulier')
    expect(form.first_name).toBe('')
    expect(form.last_name).toBe('')
    expect(form.company_name).toBeUndefined()
  })

  it('initialise les champs communs', () => {
    const form = resetFormByType('particulier')
    expect(form.adresse).toBe('')
    expect(form.code_postal).toBe('')
    expect(form.ville).toBe('')
    expect(form.country).toBe('France')
    expect(form.is_canvassing).toBe(false)
  })
})
