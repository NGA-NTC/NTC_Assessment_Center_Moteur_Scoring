---
id: ARCH-BACKEND-001
title: Architecture Backend (Supabase)
category: architecture
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - backend
  - supabase
  - postgresql
  - rpc
  - edge-functions
---

# Architecture Backend (Supabase)

## Vue d'ensemble

Le backend est entièrement hébergé sur **Supabase** (PostgreSQL + Auth + Edge Functions). Le frontend communique via le client Supabase JS (`@supabase/supabase-js`).

## Composants Supabase utilisés

| Composant | Usage | État |
|-----------|-------|------|
| **PostgreSQL** | Tables, RLS, RPC, triggers | IMPLEMENTED |
| **Auth** | Email/password, JWT, triggers | IMPLEMENTED |
| **Edge Functions** | admin-reset-password | IMPLEMENTED |
| **Realtime** | Non utilisé | — |
| **Storage** | Non utilisé | — |

## Base de données (PostgreSQL)

### Schéma public

Toutes les tables sont dans le schéma `public`.

#### Tables principales

| Table | Description | RLS |
|-------|-------------|-----|
| `profiles` | Profils utilisateurs (étend auth.users) | ✅ |
| `roles` | Rôles (candidate, admin, super_admin, ...) | ✅ |
| `permissions` | Catalogue permissions | ✅ |
| `role_permissions` | Liaison rôle ↔ permission (+ capacités) | ✅ |
| `user_roles` | Attribution rôles aux users | ✅ |
| `pages` | Pages administrables | ✅ |
| `features` | Fonctionnalités par page | ✅ |
| `page_features` | Liaison page ↔ feature | ✅ |
| `role_delegations` | Délégation rôle → rôle | ✅ |
| `user_delegations` | Délégation user → user | ✅ |
| `role_assignability` | Quels rôles un rôle peut attribuer | ✅ |

> Voir [`reference/database.md`](../reference/database.md) pour le détail complet des colonnes, FK, indexes.

### Trigger `handle_new_user`

```sql
-- Migration 20260911_p1_2_profiles_rbac.sql
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Action** : Crée `profiles` (id, email) + `user_roles` (candidate par défaut).

---

## RPC (Remote Procedure Calls)

Toutes les RPC sont `SECURITY DEFINER` + `SET search_path = public`.

| RPC | Fichier migration | Description | Sécurité |
|-----|-------------------|-------------|----------|
| `admin_get_users()` | `20260913_p1_2_4_admin_rpc_edge.sql` | Liste users + profils + rôles | `SECURITY DEFINER` + check admin/super_admin |
| `admin_reset_user_password(target_user_id)` | `20260913_p1_2_4_admin_rpc_edge.sql` | Vérif permission reset password | `SECURITY DEFINER` + check `users.change_role` |
| `bootstrap_super_admin(target_user_id)` | `20260911210000_p1_2_1_security_fix.sql` | Bootstrap super_admin (1 seul) | `SECURITY DEFINER` + check aucun super_admin existant |
| `promote_to_admin(target_user_id)` | `20260911210000_p1_2_1_security_fix.sql` | Promouvoir en admin (par super_admin) | `SECURITY DEFINER` + check super_admin + perm `users.promote_admin` |
| `has_role(user_id, role_text)` | `20260911210000_p1_2_1_security_fix.sql` | Vérifie rôle user | `SECURITY DEFINER` (stable) |
| `has_permission(user_id, perm_text)` | `20260911210000_p1_2_1_security_fix.sql` | Vérifie permission via rôles | `SECURITY DEFINER` (stable) |
| `set_updated_at()` | `20260911_p1_2_profiles_rbac.sql` | Trigger updated_at | `SECURITY DEFINER` |
| `handle_new_user()` | `20260911_p1_2_profiles_rbac.sql` | Trigger auth.users insert | `SECURITY DEFINER` (revoked from public) |

### Sécurité RPC

- Toutes `SECURITY DEFINER` + `SET search_path = public`
- Vérifications d'autorisation internes (`has_role`, `has_permission`)
- `GRANT EXECUTE` restrictif :
  - `has_role`, `has_permission` → `authenticated` (pas `anon`)
  - `bootstrap_super_admin`, `promote_to_admin` → `service_role` seulement
  - `admin_get_users`, `admin_reset_user_password` → `authenticated`

---

## Edge Functions

### `admin-reset-password` (`supabase/functions/admin-reset-password/index.ts`)

**Déclencheur** : HTTP POST (appelé depuis frontend `SuperAdminAccounts` + `AdminResultats`)

**Flux :**
1. Vérifie `Authorization: Bearer <token>`
2. Crée client Supabase avec token utilisateur (RLS appliqué)
3. Vérifie `has_permission(user_id, 'users.change_role')` via RPC
4. Vérifie existence user cible
4. Crée client **service_role** (bypass RLS)
5. `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email, redirectTo })`
6. Retourne lien de reset

**Sécurité :**
- Token utilisateur vérifié (RLS)
- Permission `users.change_role` requise (via RPC `has_permission`)
- `service_role` **uniquement** côté serveur (Edge Function)
- Token utilisateur **jamais** exposé côté frontend pour `service_role`

**Appel frontend :**
```js
const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ target_user_id: userId })
});
```

---

## Authentification Supabase

### Configuration

| Paramètre | Valeur |
|-----------|--------|
| Provider | Email / Password |
| Confirmation email | Activée (par défaut) |
| JWT expiry | Défaut Supabase (1h access, refresh token) |
| Site URL | Configuré dans Dashboard Supabase |

### Trigger `handle_new_user`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES (new.id, 'candidate') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Effet** : Tout nouvel utilisateur reçoit automatiquement :
- Profil dans `public.profiles` (id, email)
- Rôle `candidate` dans `user_roles`

---

## Edge Function : `admin-reset-password`

Fichier : `supabase/functions/admin-reset-password/index.ts`

**Dépendances :**
- `@supabase/supabase-js@2` (ESM)
- Variables d'env : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Flux complet :**
1. Vérif CORS preflight
2. Extrait `Bearer <token>` du header
2. Client Supabase user (token) → `auth.getUser()` → identité
3. RPC `has_permission(user_id, 'users.change_role')` → autorisation
4. Vérif user cible existe (`auth.users` select)
3. Client **service_role** → `auth.admin.generateLink({ type: 'recovery', email, redirectTo })`
4. Retourne `{ ok: true, message }` ou erreur

**Sécurité critique :**
- `service_role` **uniquement** côté serveur (Edge Function)
- Frontend n'a **jamais** accès à `service_role`
- Autorisation vérifiée via RPC `has_permission` (RLS appliqué sur client user)

---

## RLS (Row Level Security)

### Tables protégées

| Table | Policies clés |
|-------|---------------|
| `profiles` | select own/admin/super_admin, update own/admin/super_admin, insert admin/super_admin, delete super_admin |
| `roles` | select all authenticated, manage admin/super_admin |
| `permissions` | select all authenticated, manage admin/super_admin |
| `role_permissions` | select all authenticated, manage admin/super_admin |
| `user_roles` | select own/admin/super_admin, insert/delete admin+perm `users.change_role` / super_admin+perm |
| `pages` | select all authenticated, manage admin/super_admin |
| `features` | select all authenticated, manage admin/super_admin |
| `page_features` | select all authenticated, manage admin/super_admin |
| `role_delegations` | select/manage super_admin only |
| `user_delegations` | select super_admin + own (granter/grantee), manage super_admin |
| `role_assignability` | select/manage super_admin only |

> **Important** : Pas de `USING(true)` sur tables sensibles (délégations, assignability). Lecture restreinte au Super Admin (+ parties concernées pour user_delegations).

### Functions utilisées dans RLS

```sql
has_role(user_id, role_text) → boolean
has_permission(user_id, perm_text) → boolean
```

Les deux sont `SECURITY DEFINER`, `STABLE`, `SET search_path = public`.

---

## Stockage local (Frontend uniquement)

Géré par `src/lib/storage.js` → `window.storage` (si dispo) sinon `localStorage`.

| Clé | Structure |
|-----|-----------|
| `ntc_users` | `[{ email, password, createdAt, updatedAt, responses: {mcq, b7, b8} }]` |
| `ntc_imported` | `[{ id, label, email?, responses, createdAt, importedAt?, kind, file?, accountEmail?, hidden? }]` |
| `ntc_auth` | Session admin (token) |
| `ntc_user_session` | Session candidat |

> **Note** : Aucune donnée n'est persistée dans Supabase pour les réponses/résultats candidats (stockage 100% localStorage). Seuls les comptes (auth.users, profiles, user_roles) sont en base.

---

## Variables d'environnement

### Frontend (`.env`)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=change-me
```

### Supabase Dashboard (Edge Functions)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Auto-injecté |
| `SUPABASE_ANON_KEY` | Auto-injecté |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injecté (pour Edge Functions) |

> **Jamais** de `service_role` dans le frontend. Uniquement dans Edge Functions via variables d'env Supabase.

---

## Migrations appliquées (ordre chronologique)

| Fichier | Description | Statut |
|---------|-------------|--------|
| `20260909213412_ntc_initial_schema.sql` | Vide (placeholder) | APPLIED |
| `20260911_p1_2_profiles_rbac.sql` | Profils, RBAC de base, trigger handle_new_user | APPLIED |
| `20260911210000_p1_2_1_security_fix.sql` | Security fix, super_admin, RPC has_role/has_permission, bootstrap/promote | APPLIED |
| `20260912_p1_2_2_super_admin_cleanup.sql` | Nettoyage bootstrap (supprime candidate du super_admin) | APPLIED |
| `20260913_p1_2_4_admin_rpc_edge.sql` | RPC admin_get_users, admin_reset_user_password + Edge Function | APPLIED |
| `20260914_p1_2_5_pages_features.sql` | Tables pages, features, page_features + RLS + seed | APPLIED |
| `20260915_p1_3_1_rbac_base_schema.sql` | Extension roles (parent_id, hierarchy_level, is_assignable), role_permissions (4 capacités), user_roles (expires_at, revoked_at, revoked_by) | APPLIED |
| `20260915165400_p1_3_2_delegation_schema.sql` | role_delegations, user_delegations, role_assignability + RLS + indexes | APPLIED |

---

## Limites actuelles

| Limite | Impact |
|--------|--------|
| **Stockage 100% localStorage** | Pas de persistance résultats côté serveur |
| **Auth admin dans bundle** | Identifiants admin dans le bundle JS (prototype seulement) |
| **Mots de passe candidats en clair** | Stockés en clair dans localStorage |
| **Pas de validation serveur réponses** | Scoring 100% client-side |
| **Pas d'audit log** | Pas de traçabilité mutations (création rôle, délégation, etc.) |
| **Métiers non validés statistiquement** | Modèle indicatif seulement |

---

*Dernière mise à jour : 2026-09-15*