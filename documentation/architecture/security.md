---
id: ARCH-SECURITY-001
title: Sécurité
category: architecture
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - security
  - rls
  - rpc
  - edge-functions
---

# Sécurité

## Principe fondamental

> **Le frontend n'est JAMAIS une frontière de sécurité.**

Toute la sécurité réelle réside côté Supabase :
- **RLS** (Row Level Security) sur toutes les tables
- **RPC SECURITY DEFINER** pour mutations complexes
- **Edge Functions** avec `service_role` pour opérations Admin Auth
- **Frontend** = UX seulement (affichage/masquage selon `hasRole`/`hasPermission`)

---

## Row Level Security (RLS)

### Tables protégées et policies

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| `profiles` | own / admin / super_admin | own / admin / super_admin / delete super_admin |
| `roles` | all authenticated | admin / super_admin |
| `permissions` | all authenticated | admin / super_admin |
| `role_permissions` | all authenticated | admin / super_admin |
| `user_roles` | own / admin / super_admin | admin+perm `users.change_role` / super_admin+perm |
| `pages` / `features` / `page_features` | all authenticated | admin / super_admin |
| `role_delegations` | super_admin only | super_admin only |
| `user_delegations` | super_admin + own (granter/grantee) | super_admin only |
| `role_assignability` | super_admin only | super_admin only |

### Functions utilisées dans RLS

```sql
has_role(user_id, role_text) → boolean
has_permission(user_id, perm_text) → boolean
```

- `SECURITY DEFINER`, `STABLE`, `SET search_path = public`
- `GRANT EXECUTE` à `authenticated` (pas `anon`)

### Pas de `USING(true)` sur tables sensibles

| Table | Raison |
|-------|--------|
| `role_delegations` | Données de sécurité sensibles |
| `user_delegations` | Données sensibles + traçabilité |
| `role_assignability` | Config d'autorisation critique |

> Pas de `USING(true)` sur ces tables. Lecture restreinte au Super Admin (+ parties concernées pour `user_delegations`).

---

## RPC (Remote Procedure Calls)

### Sécurité RPC

| RPC | Security | Vérifications internes |
|-----|----------|------------------------|
| `admin_get_users()` | `SECURITY DEFINER` | Check admin/super_admin via `user_roles` |
| `admin_reset_user_password()` | `SECURITY DEFINER` | Check perm `users.change_role` |
| `bootstrap_super_admin()` | `SECURITY DEFINER` | Check aucun super_admin existant |
| `promote_to_admin()` | `SECURITY DEFINER` | Check super_admin + perm `users.promote_admin` |
| `has_role()` / `has_permission()` | `SECURITY DEFINER` | Stable, search_path sécurisé |

### Principes RPC

| Principe | Implémentation |
|----------|----------------|
| `SECURITY DEFINER` | Exécute avec privilèges owner (postgres) → bypass RLS pour lecture interne |
| `SET search_path = public` | Empêche injection schema |
| Vérifs internes | `has_role`, `has_permission` avant mutations |
| `GRANT EXECUTE` restrictif | `authenticated` (pas `anon`) pour fonctions sensibles |

### `GRANT EXECUTE` restrictif

| Fonction | Grants |
|----------|--------|
| `has_role`, `has_permission` | `authenticated` (pas `anon`) |
| `admin_get_users`, `admin_reset_user_password` | `authenticated` |
| `bootstrap_super_admin`, `promote_to_admin` | `service_role` seulement |
| `handle_new_user` | Révoqué à `anon, authenticated, public` |

---

## Edge Functions

### `admin-reset-password` (seule Edge Function actuelle)

**Fichier :** `supabase/functions/admin-reset-password/index.ts`

**Flux sécurisé :**
1. Vérif `Authorization: Bearer <token>` (header)
2. Client Supabase **avec token user** → RLS appliqué
3. `auth.getUser()` → identité
3. RPC `has_permission(user_id, 'users.change_role')` → autorisation
4. Client **service_role** (bypass RLS) → `auth.admin.generateLink()`
4. Retourne lien reset

**Sécurité critique :**
- `service_role` **uniquement** côté serveur (Edge Function)
- Frontend n'a **jamais** accès à `service_role`
- Autorisation vérifiée via RPC `has_permission` (RLS appliqué sur client user)

### Variables d'environnement Edge Functions

| Variable | Source |
|----------|--------|
| `SUPABASE_URL` | Auto-injecté Supabase |
| `SUPABASE_ANON_KEY` | Auto-injecté |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injecté (uniquement pour Edge Functions) |

> **Jamais** de `service_role` dans le frontend. Uniquement dans Edge Functions via variables d'env Supabase.

---

## Authentification

### Supabase Auth (Email/Password)

| Aspect | Configuration |
|--------|---------------|
| Provider | Email / Password |
| Confirmation email | Activée |
| JWT expiry | Défaut Supabase (1h access + refresh) |
| Mots de passe | Hashés par Supabase (bcrypt) |

### Sessions

| Type | Stockage | Durée |
|-------|-----------|-------|
| Access token | Mémoire + localStorage fallback | 1h (défaut Supabase) |
| Refresh token | HttpOnly cookie (Supabase) | Rotation auto |
| Session admin | `localStorage` (`ntc_auth`) | Persistante |
| Session candidat | `localStorage` (`ntc_user_session`) | Persistante |

> **Note** : Mots de passe candidats stockés en clair dans localStorage (prototype). Production → hash côté serveur uniquement.

### Trigger `handle_new_user`

```sql
-- Auto-création profil + rôle candidate
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Sécurité** : `REVOKE EXECUTE ON handle_new_user FROM anon, authenticated, public` — appelé uniquement par trigger.

---

## Opérations privilégiées (service_role)

### Uniquement via Edge Functions

| Opération | Edge Function | RPC utilisée |
|-----------|---------------|--------------|
| Reset MDP admin | `admin-reset-password` | `admin_reset_user_password()` + `auth.admin.generateLink()` |
| Création user admin | (futur) `create-candidate-account` | `auth.admin.createUser()` |

### Règle d'or

> **Jamais** de `service_role` dans le frontend. Uniquement dans Edge Functions via variables d'env Supabase auto-injectées.

---

## Stockage local (Frontend)

### localStorage (via `src/lib/storage.js`)

| Clé | Contenu | Sensibilité |
|-----|---------|-------------|
| `ntc_users` | Comptes candidats (email, **password en clair**, responses) | **Élevée** — prototype seulement |
| `ntc_imported` | Imports JSON (réponses, métadonnées) | Moyenne |
| `ntc_auth` | Session admin (token) | Élevée |
| `ntc_user_session` | Session candidat | Moyenne |

> **Alerte** : Mots de passe candidats en clair dans localStorage. **Prototype seulement**. Production → hash côté serveur, jamais stocké côté client.

---

## Risques connus et mitigation

| Risque | Niveau | Mitigation actuelle | À faire |
|--------|--------|---------------------|---------|
| Mots de passe en clair (localStorage) | **Critique** | Prototype seulement | Hash côté serveur, suppression localStorage |
| Admin credentials dans bundle | **Élevé** | `.env` ignoré git, pas commit | Backend dédié pour admin |
| Pas de validation serveur réponses | **Moyen** | Scoring 100% client | RPC validation + scoring serveur |
| Pas d'audit log mutations | **Moyen** | Traçabilité partielle (revoked_by, created_by) | Table `audit_log` + triggers |
| Pas de validation serveur scoring | **Moyen** | Calcul 100% client | RPC validation + scoring serveur |
| Admin credentials dans bundle JS | **Élevé** | `.env` ignoré | Backend dédié / Supabase Functions pour admin |
| Pas de rate limiting | **Faible** | Supabase gère | Configurer rate limits Supabase |
| Pas de CSP / headers sécurisés | **Faible** | Vite defaults | Configurer headers sécurité |

---

## Bonnes pratiques applicatives

### Frontend (React)

| Pratique | Implémentation |
|----------|----------------|
| Guards de routing | `ProtectedRoute`, `UserRoute`, `SuperAdminRoute` |
| Affichage conditionnel | `hasRole()`, `hasPermission()` pour UX |
| Pas de logique auth dans composants | Contextes `UserAuthContext`, `AdminAuthContext` |
| Appels RPC pour mutations | `supabase.rpc('nom_fonction', params)` |

### Backend (Supabase)

| Pratique | Implémentation |
|----------|----------------|
| RLS sur TOUTES les tables | ✅ |
| RPC `SECURITY DEFINER` pour mutations | ✅ |
| `search_path = public` sur toutes fonctions | ✅ |
| `REVOKE EXECUTE` sur fonctions sensibles | ✅ |
| `service_role` uniquement Edge Functions | ✅ |
| RLS restrictives (pas `USING(true)` sur sensibles) | ✅ |

---

## Checklist sécurité déploiement

- [ ] Variables `.env` non commitées (`.gitignore` OK)
- [ ] `service_role` absent du frontend
- [ ] RLS activées sur toutes tables publiques
- [ ] RPC `SECURITY DEFINER` + `search_path = public`
- [ ] Edge Functions utilisent `service_role` uniquement
- [ ] `service_role` key non exposée
- [ ] RLS restrictives (pas `USING(true)` sur tables sensibles)
- [ ] Audit log activé (futur)

---

## Configuration Supabase Dashboard

### Auth
- [ ] Email confirmation activée
- [ ] Site URL configurée
- [ ] Redirect URLs configurées

### Database
- [ ] RLS activées sur toutes tables `public.*`
- [ ] Policies restrictives (pas `USING(true)` sur sensibles)
- [ ] Index sur colonnes FK / dates d'expiration / révocation

### Edge Functions
- [ ] `admin-reset-password` déployée
- [ ] Variables `SUPABASE_SERVICE_ROLE_KEY` injectée
- [ ] CORS configuré

### API Settings
- [ ] Rate limiting configuré
- [ ] CORS restrictif (domaines connus)

---

## Audit trail (recommandé)

### Table `audit_log` (à créer)

```sql
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,           -- 'create_role', 'grant_role', 'delegate_permission', etc.
  target_type text NOT NULL,      -- 'role', 'user', 'permission', 'delegation'
  target_id text NOT NULL,        -- ID de la cible
  details jsonb,                  -- Détails (avant/après, scope, etc.)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_user_id);
CREATE INDEX audit_log_target_idx ON public.audit_log (target_type, target_id);
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
```

### Actions à logger

| Action | target_type | details |
|--------|-------------|---------|
| `create_role` | `role` | `{ role_id, name, parent_id }` |
| `delete_role` | `role` | `{ role_id }` |
| `grant_role` | `user_role` | `{ user_id, role_id, assigned_by }` |
| `revoke_role` | `user_role` | `{ user_id, role_id, revoked_by }` |
| `create_delegation` | `delegation` | `{ delegator_role, target_role, perm, type, scope }` |
| `revoke_delegation` | `delegation` | `{ delegation_id, revoked_by }` |
| `create_user_delegation` | `user_delegation` | `{ granter, grantee, perm, type, scope, reason }` |
| `promote_admin` | `user_role` | `{ target_user_id, promoted_by }` |
| `bootstrap_super_admin` | `user_role` | `{ target_user_id }` |

---

*Dernière mise à jour : 2026-09-15*