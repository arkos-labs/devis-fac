// ============================================================
// TYPES TypeScript — miroir du schéma Supabase
// ============================================================

export type StatutDevis = 'en_attente' | 'accepte' | 'refuse' | 'expire' | 'facture' | 'signe'
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
  tva_intracommunautaire: string | null
  iban: string | null
  bic: string | null
  forme_juridique: string | null
  code_pays: string
  assujetti_tva: boolean
  taux_tva: number
}

// ── clients ──────────────────────────────────────────────────
export type TypeClient = 'particulier' | 'professionnel'

export interface Client {
  id: string
  user_id: string
  type_client: TypeClient
  nom: string
  nom_entreprise: string | null
  siret: string | null
  tva_intracommunautaire: string | null
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
  titre: string | null
  genere_par_ia: boolean
  prompt_ia: string | null
  note_google_snapshot: number | null
  nombre_avis_google_snapshot: number | null
  signature_activee?: boolean
  signature_token?: string
  signature_date?: string | null
  created_at: string
  updated_at: string
  // Relations jointes
  clients?: Client
  lignes_prestation?: LignePrestation[]
}

// ── réponse signature publique (RPC get_devis_signature) ─────
export interface DevisSignaturePublic {
  success: boolean
  error?: string
  statut?: string
  devis?: {
    id: string; numero: string; titre: string | null; statut: StatutDevis
    date_creation: string; date_validite: string | null
    montant_ht: number; montant_total: number; notes_client: string | null
    signature_date: string | null
  }
  client?: {
    nom: string; nom_entreprise: string | null; type_client: TypeClient
    email: string | null; telephone: string | null
    adresse: string | null; ville: string | null; code_postal: string | null
    siret: string | null; tva_intracommunautaire: string | null
  }
  entreprise?: {
    nom_entreprise: string; logo_url: string | null
    siret: string | null; adresse_entreprise: string | null
    telephone_entreprise: string | null; email_entreprise: string | null
    mentions_legales: string | null
  }
  lignes?: Array<{
    description: string; detail: string | null
    quantite: number; unite: string
    prix_unitaire: number; montant_ligne: number
  }>
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
  titre: string | null
  date_paiement: string | null
  moyen_paiement: MoyenPaiement | null
  avoir_de_facture_id: string | null
  taux_penalites_retard: number | null
  indemnite_recouvrement: number | null
  note_google_snapshot: number | null
  nombre_avis_google_snapshot: number | null
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
  is_upsell: boolean
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

// ── configuration_relances ──────────────────────────────
export interface ConfigurationRelances {
  id: string
  user_id: string
  mois_sans_activite: number
  message_relance: string
  actif: boolean
  created_at: string
  updated_at: string
}

// ── relances_historique ──────────────────────────────────
export interface RelanceHistorique {
  id: string
  user_id: string
  client_id: string
  date_relance: string
  message: string
  type_relance: 'email' | 'sms' | 'notification'
  created_at: string
}

// ── Client à relancer ────────────────────────────────────
export interface ClientARelancer {
  client_id: string
  nom_client: string
  email_client: string | null
  mois_depuis_activite: number
  dernier_contact: string | null
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
      parametres_compte:        { Row: ParametresCompte;        Insert: Partial<ParametresCompte>;        Update: Partial<ParametresCompte> }
      clients:                  { Row: Client;                  Insert: Partial<Client>;                  Update: Partial<Client> }
      devis:                    { Row: Devis;                   Insert: Partial<Devis>;                   Update: Partial<Devis> }
      factures:                 { Row: Facture;                 Insert: Partial<Facture>;                 Update: Partial<Facture> }
      lignes_prestation:        { Row: LignePrestation;         Insert: Partial<LignePrestation>;         Update: Partial<LignePrestation> }
      configuration_relances:   { Row: ConfigurationRelances;   Insert: Partial<ConfigurationRelances>;   Update: Partial<ConfigurationRelances> }
      relances_historique:      { Row: RelanceHistorique;       Insert: Partial<RelanceHistorique>;       Update: Partial<RelanceHistorique> }
    }
    Functions: {
      get_next_numero:              { Args: { p_user_id: string; p_type: string }; Returns: string }
      convertir_devis_en_facture:   { Args: { p_devis_id: string; p_user_id: string }; Returns: string }
      get_dashboard_stats:          { Args: { p_user_id: string }; Returns: DashboardStats }
      get_clients_a_relancer:       { Args: { p_user_id: string }; Returns: ClientARelancer[] }
      envoyer_relance:              { Args: { p_user_id: string; p_client_id: string }; Returns: Record<string, any> }
      get_devis_signature:          { Args: { p_token: string }; Returns: DevisSignaturePublic }
      repondre_devis_signature:     { Args: { p_token: string; p_reponse: 'signe' | 'refuse' }; Returns: { success: boolean; error?: string; statut?: string } }
    }
  }
}
