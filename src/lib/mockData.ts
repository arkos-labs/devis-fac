// ============================================================
// DONNÉES DE DÉMONSTRATION — CRM Prestation Spécialisé
// Utilisées quand VITE_DEMO_MODE=true
// ============================================================
import type {
  Client, Devis, Facture, LignePrestation,
  ParametresCompte, DashboardStats
} from '@/types/database'

export const DEMO_USER_ID = 'demo-user-00000000-0000-0000-0000-000000000001'

// ── Paramètres compte ─────────────────────────────────────────
export const DEMO_PARAMETRES: ParametresCompte = {
  id: 'param-001',
  user_id: DEMO_USER_ID,
  nom_entreprise: 'Mon Entreprise',
  siret: '99039012200028',
  adresse_entreprise: '15 avenue de la République, 75011 Paris',
  telephone_entreprise: '06 12 34 56 78',
  email_entreprise: 'contact@exemple.fr',
  logo_url: null,
  signature_url: null,
  mentions_legales: "Auto-entrepreneur – TVA non applicable, art. 293 B du CGI.",
  avis_google_url: 'https://g.page/r/exemple',
  note_google: 4.9,
  nombre_avis_google: 47,
  afficher_avis_sur_devis: true,
  afficher_avis_sur_factures: true,
  prochain_num_devis: 9,
  prochain_num_facture: 7,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
  tva_intracommunautaire: null,
  iban: null,
  bic: null,
  forme_juridique: 'Auto-entrepreneur',
  code_pays: 'FR',
  assujetti_tva: false,
  taux_tva: 0,
}

// ── Clients ───────────────────────────────────────────────────
export const DEMO_CLIENTS: Client[] = [
  {
    id: 'client-001', user_id: DEMO_USER_ID,
    type_client: 'particulier', nom_entreprise: null, siret: null, tva_intracommunautaire: null,
    nom: 'Marie Dupont', email: 'marie.dupont@gmail.com',
    telephone: '06 11 22 33 44',
    adresse: '12 rue de la Paix', ville: 'Paris', code_postal: '75001',
    notes: 'Cliente fidèle depuis 2023. Préfère les interventions le matin.',
    date_creation: '2024-03-15T10:00:00Z', dernier_contact: '2026-09-10T09:00:00Z',
  },
  {
    id: 'client-002', user_id: DEMO_USER_ID,
    type_client: 'professionnel', nom_entreprise: 'Cabinet Martin & Associés', siret: '12345678900012', tva_intracommunautaire: 'FR12123456789',
    nom: 'Jean-Pierre Martin', email: 'contact@martin-avocats.fr',
    telephone: '01 42 33 44 55',
    adresse: '45 boulevard Haussmann', ville: 'Paris', code_postal: '75008',
    notes: 'Bureau 3 étages. Prestation mensuel.',
    date_creation: '2024-05-02T14:00:00Z', dernier_contact: '2026-09-01T08:30:00Z',
  },
  {
    id: 'client-003', user_id: DEMO_USER_ID,
    type_client: 'particulier', nom_entreprise: null, siret: null, tva_intracommunautaire: null,
    nom: 'Sophie & Thomas Renard', email: 'renard.famille@orange.fr',
    telephone: '06 55 66 77 88',
    adresse: '8 allée des Roses', ville: 'Versailles', code_postal: '78000',
    notes: 'Villa 220m². Après travaux. Très satisfaits.',
    date_creation: '2024-07-20T11:00:00Z', dernier_contact: '2026-08-28T10:00:00Z',
  },
  {
    id: 'client-004', user_id: DEMO_USER_ID,
    type_client: 'professionnel', nom_entreprise: 'Restaurant Le Gourmet', siret: '98765432100098', tva_intracommunautaire: 'FR98987654321',
    nom: 'Direction', email: 'direction@legourmet.fr',
    telephone: '01 48 12 34 56',
    adresse: '22 rue du Faubourg', ville: 'Neuilly-sur-Seine', code_postal: '92200',
    notes: 'Prestation cuisine professionnelle hebdomadaire.',
    date_creation: '2025-01-10T09:00:00Z', dernier_contact: '2026-09-20T07:00:00Z',
  },
  {
    id: 'client-005', user_id: DEMO_USER_ID,
    type_client: 'particulier', nom_entreprise: null, siret: null, tva_intracommunautaire: null,
    nom: 'Isabelle Moreau', email: 'isabelle.moreau@free.fr',
    telephone: '07 98 76 54 32',
    adresse: '3 impasse du Moulin', ville: 'Boulogne-Billancourt', code_postal: '92100',
    notes: 'Appartement 65m². Déménagement prévu en octobre.',
    date_creation: '2026-06-14T16:00:00Z', dernier_contact: '2026-09-15T14:00:00Z',
  },
  {
    id: 'client-006', user_id: DEMO_USER_ID,
    type_client: 'professionnel', nom_entreprise: 'SCI Les Pins Dorés', siret: '55555555500055', tva_intracommunautaire: 'FR55555555555',
    nom: 'Gestion', email: 'gestion@scilespins.fr',
    telephone: '01 39 45 67 89',
    adresse: '100 avenue du Général de Gaulle', ville: 'Saint-Cloud', code_postal: '92210',
    notes: 'Immeuble 6 appartements. Contrat annuel parties communes.',
    date_creation: '2025-03-05T10:00:00Z', dernier_contact: '2026-09-05T11:00:00Z',
  },
]

// ── Lignes prestation ─────────────────────────────────────────
export const DEMO_LIGNES: LignePrestation[] = [
  // Devis D-0005 (Maison 75m²)
  { id: 'l-001', user_id: DEMO_USER_ID, document_type: 'devis', document_id: 'devis-005',
    ordre: 0, description: 'Prestation des sols', detail: 'Aspiration, lavage et lustrage de tous les revêtements',
    quantite: 75, unite: 'm²', prix_unitaire: 2.5, montant_ligne: 187.5, is_upsell: false, created_at: '2026-09-01T10:00:00Z' },
  { id: 'l-002', user_id: DEMO_USER_ID, document_type: 'devis', document_id: 'devis-005',
    ordre: 1, description: 'Dépoussiérage général', detail: 'Meubles, plinthes, prises, interrupteurs',
    quantite: 1, unite: 'forfait', prix_unitaire: 95, montant_ligne: 95, is_upsell: false, created_at: '2026-09-01T10:00:00Z' },
  { id: 'l-003', user_id: DEMO_USER_ID, document_type: 'devis', document_id: 'devis-005',
    ordre: 2, description: 'Prestation cuisine', detail: 'Dégraissage four, hotte, plan de travail, évier',
    quantite: 1, unite: 'forfait', prix_unitaire: 120, montant_ligne: 120, is_upsell: false, created_at: '2026-09-01T10:00:00Z' },
  { id: 'l-004', user_id: DEMO_USER_ID, document_type: 'devis', document_id: 'devis-005',
    ordre: 3, description: 'Prestation salle de bain', detail: 'Détartrage, joints, miroirs, sanitaires',
    quantite: 2, unite: 'pièce', prix_unitaire: 65, montant_ligne: 130, is_upsell: false, created_at: '2026-09-01T10:00:00Z' },
  { id: 'l-005', user_id: DEMO_USER_ID, document_type: 'devis', document_id: 'devis-005',
    ordre: 4, description: 'Prestation vitres', detail: 'Intérieur et extérieur accessible',
    quantite: 8, unite: 'pièce', prix_unitaire: 12, montant_ligne: 96, is_upsell: false, created_at: '2026-09-01T10:00:00Z' },

  // Facture F-0003 (Cabinet)
  { id: 'l-010', user_id: DEMO_USER_ID, document_type: 'facture', document_id: 'facture-003',
    ordre: 0, description: 'Prestation bureaux', detail: 'Aspiration moquettes, essuyage bureaux et écrans',
    quantite: 3, unite: 'étage', prix_unitaire: 180, montant_ligne: 540, is_upsell: false, created_at: '2026-09-05T08:00:00Z' },
  { id: 'l-011', user_id: DEMO_USER_ID, document_type: 'facture', document_id: 'facture-003',
    ordre: 1, description: 'Prestation sanitaires', detail: 'Désinfection complète des 4 blocs sanitaires',
    quantite: 4, unite: 'pièce', prix_unitaire: 45, montant_ligne: 180, is_upsell: false, created_at: '2026-09-05T08:00:00Z' },
  { id: 'l-012', user_id: DEMO_USER_ID, document_type: 'facture', document_id: 'facture-003',
    ordre: 2, description: 'Prestation salle de réunion', detail: 'Vitres, tables, sièges, tableau',
    quantite: 1, unite: 'forfait', prix_unitaire: 130, montant_ligne: 130, is_upsell: false, created_at: '2026-09-05T08:00:00Z' },
]

// ── Devis ─────────────────────────────────────────────────────
export const DEMO_DEVIS = [
  {
    id: 'devis-001', user_id: DEMO_USER_ID, client_id: 'client-001',
    numero: 'D-0001', statut: 'accepte',
    date_creation: '2026-07-03T09:00:00Z', date_validite: '2026-08-03T00:00:00Z',
    montant_ht: 850, montant_total: 850,
    notes_client: 'Intervention prévue le 10 juillet matin.', notes_internes: null,
    genere_par_ia: false, prompt_ia: null,
    created_at: '2026-07-03T09:00:00Z', updated_at: '2026-07-05T14:00:00Z',
    clients: DEMO_CLIENTS[0],
  },
  {
    id: 'devis-002', user_id: DEMO_USER_ID, client_id: 'client-002',
    numero: 'D-0002', statut: 'accepte',
    date_creation: '2026-07-15T14:00:00Z', date_validite: '2026-08-15T00:00:00Z',
    montant_ht: 850, montant_total: 850,
    notes_client: 'Contrat mensuel reconductible.', notes_internes: 'Clés disponibles en loge',
    genere_par_ia: false, prompt_ia: null,
    created_at: '2026-07-15T14:00:00Z', updated_at: '2026-07-16T10:00:00Z',
    clients: DEMO_CLIENTS[1],
  },
  {
    id: 'devis-003', user_id: DEMO_USER_ID, client_id: 'client-003',
    numero: 'D-0003', statut: 'accepte',
    date_creation: '2026-08-01T10:00:00Z', date_validite: '2026-09-01T00:00:00Z',
    montant_ht: 1650, montant_total: 1650,
    notes_client: 'Prestation complet après travaux de rénovation.', notes_internes: null,
    genere_par_ia: true, prompt_ia: 'Villa 220m² après travaux rénovation complète',
    created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-03T16:00:00Z',
    clients: DEMO_CLIENTS[2],
  },
  {
    id: 'devis-004', user_id: DEMO_USER_ID, client_id: 'client-004',
    numero: 'D-0004', statut: 'accepte',
    date_creation: '2026-08-20T08:30:00Z', date_validite: '2026-09-20T00:00:00Z',
    montant_ht: 420, montant_total: 420,
    notes_client: null, notes_internes: 'Intervention le lundi avant ouverture (6h-8h)',
    genere_par_ia: false, prompt_ia: null,
    created_at: '2026-08-20T08:30:00Z', updated_at: '2026-08-21T11:00:00Z',
    clients: DEMO_CLIENTS[3],
  },
  {
    id: 'devis-005', user_id: DEMO_USER_ID, client_id: 'client-001',
    numero: 'D-0005', statut: 'en_attente',
    date_creation: '2026-09-01T10:00:00Z', date_validite: '2026-10-01T00:00:00Z',
    montant_ht: 628.5, montant_total: 628.5,
    notes_client: "Sous réserve de disponibilité d'eau et d'électricité.", notes_internes: null,
    genere_par_ia: true, prompt_ia: 'Prestation maison 75m²',
    created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:05:00Z',
    clients: DEMO_CLIENTS[0],
    lignes_prestation: DEMO_LIGNES.filter(l => l.document_id === 'devis-005'),
  },
  {
    id: 'devis-006', user_id: DEMO_USER_ID, client_id: 'client-005',
    numero: 'D-0006', statut: 'en_attente',
    date_creation: '2026-09-15T14:00:00Z', date_validite: '2026-10-15T00:00:00Z',
    montant_ht: 380, montant_total: 380,
    notes_client: 'Prestation état des lieux sortant.', notes_internes: null,
    genere_par_ia: true, prompt_ia: 'Appartement 65m² état des lieux sortant',
    created_at: '2026-09-15T14:00:00Z', updated_at: '2026-09-15T14:10:00Z',
    clients: DEMO_CLIENTS[4],
  },
  {
    id: 'devis-007', user_id: DEMO_USER_ID, client_id: 'client-006',
    numero: 'D-0007', statut: 'refuse',
    date_creation: '2026-09-10T09:00:00Z', date_validite: '2026-10-10T00:00:00Z',
    montant_ht: 2100, montant_total: 2100,
    notes_client: null, notes_internes: 'Refus : budget trop élevé selon client',
    genere_par_ia: false, prompt_ia: null,
    created_at: '2026-09-10T09:00:00Z', updated_at: '2026-09-18T10:00:00Z',
    clients: DEMO_CLIENTS[5],
  },
  {
    id: 'devis-008', user_id: DEMO_USER_ID, client_id: 'client-002',
    numero: 'D-0008', statut: 'en_attente',
    date_creation: '2026-09-22T11:00:00Z', date_validite: '2026-10-22T00:00:00Z',
    montant_ht: 850, montant_total: 850,
    notes_client: 'Renouvellement contrat mensuel — Octobre 2026.', notes_internes: null,
    genere_par_ia: false, prompt_ia: null,
    created_at: '2026-09-22T11:00:00Z', updated_at: '2026-09-22T11:00:00Z',
    clients: DEMO_CLIENTS[1],
  },
] as Devis[]

// ── Factures ──────────────────────────────────────────────────
export const DEMO_FACTURES = [
  {
    id: 'facture-001', user_id: DEMO_USER_ID, client_id: 'client-001', devis_id: 'devis-001',
    numero: 'F-0001', statut: 'payee',
    date_creation: '2026-07-10T10:00:00Z', date_echeance: '2026-08-10T00:00:00Z',
    montant_ht: 850, montant_total: 850,
    notes_client: null, notes_internes: null,
    date_paiement: '2026-07-25T14:00:00Z', moyen_paiement: 'virement',
    avoir_de_facture_id: null, taux_penalites_retard: 12, indemnite_recouvrement: 40,
    created_at: '2026-07-10T10:00:00Z', updated_at: '2026-07-25T14:00:00Z',
    clients: DEMO_CLIENTS[0],
  },
  {
    id: 'facture-002', user_id: DEMO_USER_ID, client_id: 'client-003', devis_id: 'devis-003',
    numero: 'F-0002', statut: 'payee',
    date_creation: '2026-08-10T09:00:00Z', date_echeance: '2026-09-10T00:00:00Z',
    montant_ht: 1650, montant_total: 1650,
    notes_client: null, notes_internes: null,
    date_paiement: '2026-08-20T11:00:00Z', moyen_paiement: 'cheque',
    avoir_de_facture_id: null, taux_penalites_retard: 12, indemnite_recouvrement: 40,
    created_at: '2026-08-10T09:00:00Z', updated_at: '2026-08-20T11:00:00Z',
    clients: DEMO_CLIENTS[2],
  },
  {
    id: 'facture-003', user_id: DEMO_USER_ID, client_id: 'client-002', devis_id: 'devis-002',
    numero: 'F-0003', statut: 'payee',
    date_creation: '2026-09-05T08:00:00Z', date_echeance: '2026-10-05T00:00:00Z',
    montant_ht: 850, montant_total: 850,
    notes_client: null, notes_internes: null,
    date_paiement: '2026-09-12T09:00:00Z', moyen_paiement: 'virement',
    avoir_de_facture_id: null, taux_penalites_retard: 12, indemnite_recouvrement: 40,
    created_at: '2026-09-05T08:00:00Z', updated_at: '2026-09-12T09:00:00Z',
    clients: DEMO_CLIENTS[1],
    lignes_prestation: DEMO_LIGNES.filter(l => l.document_id === 'facture-003'),
  },
  {
    id: 'facture-004', user_id: DEMO_USER_ID, client_id: 'client-004', devis_id: 'devis-004',
    numero: 'F-0004', statut: 'payee',
    date_creation: '2026-09-08T07:00:00Z', date_echeance: '2026-10-08T00:00:00Z',
    montant_ht: 420, montant_total: 420,
    notes_client: null, notes_internes: null,
    date_paiement: '2026-09-09T12:00:00Z', moyen_paiement: 'especes',
    avoir_de_facture_id: null, taux_penalites_retard: 12, indemnite_recouvrement: 40,
    created_at: '2026-09-08T07:00:00Z', updated_at: '2026-09-09T12:00:00Z',
    clients: DEMO_CLIENTS[3],
  },
  {
    id: 'facture-005', user_id: DEMO_USER_ID, client_id: 'client-002', devis_id: null,
    numero: 'F-0005', statut: 'en_attente',
    date_creation: '2026-09-20T08:00:00Z', date_echeance: '2026-10-20T00:00:00Z',
    montant_ht: 850, montant_total: 850,
    notes_client: 'Prestation mensuel — Septembre 2026.', notes_internes: null,
    date_paiement: null, moyen_paiement: null,
    avoir_de_facture_id: null, taux_penalites_retard: 12, indemnite_recouvrement: 40,
    created_at: '2026-09-20T08:00:00Z', updated_at: '2026-09-20T08:00:00Z',
    clients: DEMO_CLIENTS[1],
  },
  {
    id: 'facture-006', user_id: DEMO_USER_ID, client_id: 'client-006', devis_id: null,
    numero: 'F-0006', statut: 'retard',
    date_creation: '2026-08-15T10:00:00Z', date_echeance: '2026-09-15T00:00:00Z',
    montant_ht: 320, montant_total: 320,
    notes_client: null, notes_internes: '2ème relance envoyée le 20/09',
    date_paiement: null, moyen_paiement: null,
    avoir_de_facture_id: null, taux_penalites_retard: 12, indemnite_recouvrement: 40,
    created_at: '2026-08-15T10:00:00Z', updated_at: '2026-09-20T09:00:00Z',
    clients: DEMO_CLIENTS[5],
  },
] as Facture[]

// ── Stats Dashboard ───────────────────────────────────────────
export const DEMO_STATS: DashboardStats = {
  ca_mois_courant:      3_770,   // Factures payées en septembre
  ca_annee_courante:    12_490,  // CA total 2026
  ca_a_venir:           1_170,   // Factures en attente
  taux_acceptation_devis: 71.4,  // 5 acceptés / 7 conclus
  devis_en_attente:     3,
  factures_en_retard:   1,
  total_clients:        6,
}

// ── Graphique CA 12 mois ──────────────────────────────────────
export const DEMO_CHART = [
  { mois: 'Oct', ca: 980  },
  { mois: 'Nov', ca: 1400 },
  { mois: 'Déc', ca: 890  },
  { mois: 'Jan', ca: 1250 },
  { mois: 'Fév', ca: 1800 },
  { mois: 'Mar', ca: 2100 },
  { mois: 'Avr', ca: 1950 },
  { mois: 'Mai', ca: 2450 },
  { mois: 'Juin', ca: 2800 },
  { mois: 'Juil', ca: 850  },
  { mois: 'Août', ca: 1650 },
  { mois: 'Sep', ca: 3770 },
]
