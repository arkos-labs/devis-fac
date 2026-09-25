# Migration : Système de Relances Automatiques

**Date** : 2026-09-25
**Statut** : À appliquer à Supabase

## ✅ Changements

### 1. **Tables SQL ajoutées**
- `configuration_relances` - Configuration des relances par utilisateur
- `relances_historique` - Track des relances envoyées

### 2. **Fonctions PostgreSQL ajoutées**
- `get_clients_a_relancer(p_user_id)` - Trouve les clients sans activité depuis X mois
- `envoyer_relance(p_user_id, p_client_id)` - Envoie une relance et enregistre l'action

### 3. **Edge Function ajoutée**
- `process-reminders` - Déclenche les relances automatiques

### 4. **Types TypeScript**
- `ConfigurationRelances` - Configuration de relance
- `RelanceHistorique` - Entrée d'historique
- `ClientARelancer` - Client à relancer

### 5. **Composants React**
- `RemindersSection` - Panneau de configuration dans les Paramètres
- `useReminders` - Hook pour interagir avec le système

## 🚀 Étapes d'application

### Étape 1 : Appliquer le schéma SQL
1. Ouvrir l'SQL Editor de Supabase
2. Copier tout le contenu de `schema.sql`
3. Exécuter le script

**Ou** exécuter les modifications en fichier SQL séparé :

```sql
-- Copier les sections 5, 5b, 13, 14, 15, 16 du schema.sql
-- Commençant par "TABLE : configuration_relances"
-- Jusqu'à "GRANT EXECUTE ON FUNCTION public.envoyer_relance"
```

### Étape 2 : Déployer l'Edge Function
```bash
# Dans supabase/functions/process-reminders/
supabase functions deploy process-reminders --project-ref acfbjyqameiswpvxagyr
```

Ou manuellement via le dashboard Supabase :
1. Aller dans Functions
2. Créer une nouvelle fonction `process-reminders`
3. Copier le code de `supabase/functions/process-reminders/index.ts`

### Étape 3 : Configurer un Cron (optionnel)
Pour déclencher les relances automatiquement chaque semaine :

```bash
supabase functions deploy process-reminders --project-ref acfbjyqameiswpvxagyr
```

Puis dans le dashboard :
- Aller dans Database → Cron
- Créer une tâche :
  - **Fonction** : `process-reminders`
  - **Schedule** : `0 8 * * 1` (lundi 8h)
  - **Body** : `{}`

## 🧪 Test

1. Dans ParametresPage, accéder à la nouvelle section "Relances automatiques"
2. Configurer :
   - Délai : 6 mois
   - Message : votre texte
   - Activer/désactiver
3. Cliquer "Relancer tous" pour envoyer les relances manuellement

## 📋 Données de test

Pour tester, créer un client avec une `dernier_contact` datant de plus de 6 mois :

```sql
UPDATE clients
SET dernier_contact = now() - INTERVAL '7 months'
WHERE nom = 'Client Test';
```

Puis cliquer "Relancer tous" - le client devrait apparaître et pouvoir être relancé.

## ⚠️ Points importants

- Les relances envoient un **email** (à intégrer avec SendGrid, Resend, etc.)
- L'historique évite les doublons (1 relance max par 30 jours)
- Le système est **entièrement configurable** dans les Paramètres
- **Pas de paiement** à gérer - juste du suivi

## 📝 Prochaines étapes

1. ✅ Appliquer la migration SQL
2. ✅ Déployer l'Edge Function
3. ⏳ Intégrer un service d'email (SendGrid, Resend, Mailgun, etc.)
4. ⏳ Ajouter des notifications SMS (optional)
5. ⏳ Configurer le Cron pour automatiser complètement
