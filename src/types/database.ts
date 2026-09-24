// ============================================================
// TYPES TypeScript — miroir du schéma Supabase
// ============================================================

export type StatutDevis = 'en_attente' | 'accepte' | 'refuse' | 'expire'
export type StatutFacture = 'en_attente' | 'payee' | 'retard' | 'annulee'
export type MoyenPaiement = 'virement' | 'cheque' | 'especes' | 'carte' | 'autre'
export type DocumentType = 'devis' | 'facture'

// ── parametres_compte ────────────────────────────────────────
export interface ParametresCompte {
  id: string
  user_id: string
  nom_entreprise: string
  siret: string
  adresse_entreprise: string | null
  telephone_entreprise: string | null
  email_entreprise: string | null
  logo_url: string | null
  signature_url: string | null
  mentions_legales: string
  avis_google_url: string | null
  note_google: number
  nombre_avis_google: number
  afficher_avis_sur_devis: boolean
  afficher_avis_sur_factures: boolean
  prochain_num_devis: number
  prochain_num_facture: number
  created_at: string
  updated_at: string
}

// ── clients ──────────────────────────────────────────────────
export interface Client {
  id: string
  user_id: string
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  notes: string | null
  date_creation: string
  dernier_contact: string | null
}

// ── devis ────────────────────────────────────────────────────
export interface Devis {
  id: string
  user_id: string
  client_id: string
  numero: string
  date_creation: string
  date_validite: string | null
  statut: StatutDevis
  montant_ht: number
  montant_total: number
  notes_client: string | null
  notes_internes: string | null
  genere_par_ia: boolean
  prompt_ia: string | null
  created_at: string
  updated_at: string
  // Relations jointes
  clients?: Client
  lignes_prestation?: LignePrestation[]
}

// ── factures ─────────────────────────────────────────────────
export interface Facture {
  id: string
  user_id: string
  client_id: string
  devis_id: string | null
  numero: string
  date_creation: string
  date_echeance: string | null
  statut: StatutFacture
  montant_ht: number
  montant_total: number
  notes_client: string | null
  notes_internes: string | null
  date_paiement: string | null
  moyen_paiement: MoyenPaiement | null
  avoir_de_facture_id: string | null
  taux_penalites_retard: number | null
  indemnite_recouvrement: number | null
  created_at: string
  updated_at: string
  // Relations jointes
  clients?: Client
  devis?: Devis | null
  lignes_prestation?: LignePrestation[]
  avoir_de_facture?: Facture | null
}

// ── lignes_prestation ────────────────────────────────────────
export interface LignePrestation {
  id: string
  user_id: string
  document_type: DocumentType
  document_id: string
  ordre: number
  description: string
  detail: string | null
  quantite: number
  unite: string
  prix_unitaire: number
  montant_ligne: number
  created_at: string
}

// ── Dashboard Stats ─────────────────────────────────────────
export interface DashboardStats {
  ca_mois_courant: number
  ca_annee_courante: number
  ca_a_venir: number
  taux_acceptation_devis: number
  devis_en_attente: number
  factures_en_retard: number
  total_clients: number
}

// ── IA Response ──────────────────────────────────────────────
export interface IAPrestationItem {
  description: string
  detail: string
  quantite: number
  unite: string
  prix_unitaire: number
}

export interface IADevisResponse {
  titre: string
  prestations: IAPrestationItem[]
  notes_client: string
}

// ── Supabase Database type (simplifié) ───────────────────────
export type Database = {
  public: {
    Tables: {
      parametres_compte: { Row: ParametresCompte; Insert: Partial<ParametresCompte>; Update: Partial<ParametresCompte> }
      clients:           { Row: Client;            Insert: Partial<Client>;            Update: Partial<Client> }
      devis:             { Row: Devis;             Insert: Partial<Devis>;             Update: Partial<Devis> }
      factures:          { Row: Facture;           Insert: Partial<Facture>;           Update: Partial<Facture> }
      lignes_prestation: { Row: LignePrestation;   Insert: Partial<LignePrestation>;   Update: Partial<LignePrestation> }
    }
    Functions: {
      get_next_numero:              { Args: { p_user_id: string; p_type: string }; Returns: string }
      convertir_devis_en_facture:   { Args: { p_devis_id: string; p_user_id: string }; Returns: string }
      get_dashboard_stats:          { Args: { p_user_id: string }; Returns: DashboardStats }
    }
  }
}
