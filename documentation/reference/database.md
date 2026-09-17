---
id: REF-DATABASE-001
title: Référence Base de Données
category: reference
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - database
  - reference
  - tables
  - schema
---

# Référence Base de Données

> Voir aussi : [`architecture/database.md`](../../architecture/database.md) pour le schéma complet avec descriptions.

---

## Tables principales

| Table | Description | RLS | Migration |
|-------|-------------|-----|-----------|
| `profiles` | Profils utilisateurs | ✅ | P1.2 |
| `roles` | Rôles + hiérarchie | ✅ | P1.2 + P1.3.1 |
| `permissions` | Catalogue permissions | ✅ | P1.2 |
| `role_permissions` | Rôle ↔ Permission (+ 4 capacités) | ✅ | P1.2 + P1.3.1 |
| `user_roles` | User ↔ Rôle (+ traçabilité) | ✅ | P1.2 + P1.3.1 |
| `pages` | Pages administrables + audience | ✅ | P1.2.5 |
| `features` | Fonctionnalités + audience + scope | ✅ | P1.2.5 |
| `page_features` | Liaison page ↔ feature | ✅ | P1.2.5 |
| `role_delegations` | Délégation rôle → rôle | ✅ | P1.3.2 |
| `user_delegations` | Délégation user → user | ✅ | P1.3.2 |
| `role_assignability` | Quels rôles un rôle peut attribuer | ✅ | P1.3.2 |

---

## Tables détaillées

### `profiles`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | uuid | PK, FK → `auth.users(id)` CASCADE |
| `email` | text | NOT NULL |
| `first_name` | text | |
| `last_name` | text | |
| `phone` | text | |
| `avatar_url` | text | |
| `linkedin_url` | text | |
| `job_title` | text | |
| `location` | text | |
| `bio` | text | |
| `status` | text | NOT NULL DEFAULT 'active' CHECK ∈ ('active','inactive','suspended') |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() (trigger) |

**Indexes :** `profiles_email_idx`, `profiles_status_idx`

---

### `roles`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | text | PK |
| `name` | text | NOT NULL |
| `description` | text | |
| `is_system` | boolean | DEFAULT false |
| `parent_id` | text | FK → `roles(id)` SET NULL |
| `hierarchy_level` | int | DEFAULT 0 |
| `is_assignable` | boolean | DEFAULT true |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() (trigger) |

**Index :** `roles_parent_id_idx`

**Seed :**
```sql
('candidate', 'Candidat', 'Utilisateur passant les assessments', true),
('admin', 'Administrateur', 'Accès complet à l''administration', true),
('super_admin', 'Super Administrateur', 'Propriétaire du système', true)
```

---

### `permissions`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | text | PK |
| `name` | text | NOT NULL |
| `description` | text | |
| `category` | text | DEFAULT 'general' |
| `created_at` | timestamptz | DEFAULT now() |

**Catégories :** `users`, `profile`, `assessment`, `results`

---

### `role_permissions`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `role_id` | text | PK, FK → `roles(id)` CASCADE | |
| `permission_id` | text | PK, FK → `permissions(id)` CASCADE | |
| `can_use` | boolean | DEFAULT false | Capacité USE |
| `can_manage` | boolean | DEFAULT false | Capacité MANAGE |
| `can_grant` | boolean | DEFAULT false | Capacité GRANT |
| `can_delegate` | boolean | DEFAULT false | Capacité DELEGATE |

**PK composite :** `(role_id, permission_id)`

**Migration P1.3.1 :** Anciennes permissions → `can_use = true`

---

### `user_roles`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `user_id` | uuid | PK, FK → `auth.users(id)` CASCADE |
| `role_id` | text | PK, FK → `roles(id)` CASCADE |
| `assigned_by` | uuid | FK → `auth.users(id)` |
| `assigned_at` | timestamptz | DEFAULT now() |
| `expires_at` | timestamptz | NULLABLE (P1.3.1) |
| `revoked_at` | timestamptz | NULLABLE (P1.3.1) |
| `revoked_by` | uuid | FK → `auth.users(id)` SET NULL (P1.3.1) |

**PK composite :** `(user_id, role_id)`

**Indexes :** `user_roles_user_id_idx`, `user_roles_role_id_idx`, `user_roles_expires_at_idx`, `user_roles_revoked_at_idx`

---

### `pages`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | text | PK |
| `name` | text | NOT NULL |
| `path` | text | NOT NULL |
| `description` | text | |
| `icon` | text | |
| `is_system` | boolean | DEFAULT false |
| `access_audience` | text | NOT NULL DEFAULT 'authenticated' CHECK ∈ ('public','authenticated','role_based') |
| `access_permission` | text | FK → `permissions(id)` NULLABLE |
| `created_at` / `updated_at` | timestamptz | DEFAULT now() |

**Indexes :** `pages_name_idx`, `pages_path_idx`

---

### `features`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | text | PK |
| `name` | text | NOT NULL |
| `description` | text | |
| `page_id` | text | NOT NULL, FK → `pages(id)` CASCADE |
| `category` | text | |
| `is_system` | boolean | DEFAULT false |
| `access_audience` | text | NOT NULL DEFAULT 'role_based' CHECK ∈ ('public','authenticated','role_based') |
| `access_permission` | text | FK → `permissions(id)` NULLABLE |
| `access_scope_type` | text | CHECK ∈ ('global','role','user','self') NULLABLE |
| `access_scope_value` | text | NULLABLE |
| `created_at` / `updated_at` | timestamptz | DEFAULT now() |

**Indexes :** `features_page_id_idx`, `features_name_idx`

---

### `page_features`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `page_id` | text | PK, FK → `pages(id)` CASCADE |
| `feature_id` | text | PK, FK → `features(id)` CASCADE |

**PK composite :** `(page_id, feature_id)`

---

### `role_delegations` (P1.3.2)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `delegator_role_id` | text | NOT NULL, FK → `roles(id)` RESTRICT |
| `target_role_id` | text | NOT NULL, FK → `roles(id)` RESTRICT |
| `permission_id` | text | NOT NULL, FK → `permissions(id)` RESTRICT |
| `delegation_type` | text | NOT NULL CHECK ∈ ('use','manage','grant') |
| `scope_type` | text | NOT NULL DEFAULT 'global' CHECK ∈ ('global','role','user','self') |
| `scope_value` | text | NULLABLE |
| `created_by` | uuid | NOT NULL FK → `auth.users(id)` RESTRICT |
| `created_at` | timestamptz | DEFAULT now() |
| `expires_at` | timestamptz | NULLABLE |
| `revoked_at` | timestamptz | NULLABLE |
| `revoked_by` | uuid | FK → `auth.users(id)` SET NULL |

**CHECK :** `delegator_role_id != target_role_id`, `expires_at > created_at`, `revoked_at >= created_at`

**Indexes :** `delegator_role_id`, `target_role_id`, `permission_id`, `expires_at`, `revoked_at`

---

### `user_delegations` (P1.3.2)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `granter_user_id` | uuid | NOT NULL FK → `auth.users(id)` RESTRICT |
| `grantee_user_id` | uuid | NOT NULL FK → `auth.users(id)` RESTRICT |
| `permission_id` | text | NOT NULL FK → `permissions(id)` RESTRICT |
| `delegation_type` | text | CHECK ∈ ('use','manage','grant') |
| `scope_type` | text | DEFAULT 'global' CHECK ∈ ('global','role','user','self') |
| `scope_value` | text | NULLABLE |
| `reason` | text | NULLABLE |
| `created_at` | timestamptz | DEFAULT now() |
| `expires_at` / `revoked_at` | timestamptz | NULLABLE |
| `revoked_by` | uuid | FK → `auth.users(id)` SET NULL |

**CHECK :** `granter_user_id != grantee_user_id`

**Indexes :** `granter_user_id`, `grantee_user_id`, `permission_id`, `expires_at`, `revoked_at`

---

### `role_assignability` (P1.3.2)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `assigner_role_id` | text | PK, FK → `roles(id)` RESTRICT |
| `assignable_role_id` | text | PK, FK → `roles(id)` RESTRICT |
| `created_by` | uuid | NOT NULL FK → `auth.users(id)` RESTRICT |
| `created_at` | timestamptz | DEFAULT now() |

**PK composite :** `(assigner_role_id, assignable_role_id)`

**CHECK :** `assigner_role_id != assignable_role_id`

**Indexes :** `assigner_role_id`, `assignable_role_id`

---

## Fonctions importantes

| Fonction | Type | Sécurité | Description |
|----------|------|----------|-------------|
| `has_role(user_id, role_text)` | SQL | SECURITY DEFINER | Vérifie rôle user |
| `has_permission(user_id, perm_text)` | SQL | SECURITY DEFINER | Vérifie permission via rôles |
| `admin_get_users()` | PL/pgSQL | SECURITY DEFINER | Liste users + rôles + profils |
| `admin_reset_user_password(uid)` | PL/pgSQL | SECURITY DEFINER | Vérif perm + notice |
| `bootstrap_super_admin(uid)` | PL/pgSQL | SECURITY DEFINER | Bootstrap 1er super_admin |
| `promote_to_admin(uid)` | PL/pgSQL | SECURITY DEFINER | Promote par super_admin |
| `handle_new_user()` | PL/pgSQL | SECURITY DEFINER | Trigger auth.users insert |
| `set_updated_at()` | PL/pgSQL | SECURITY DEFINER | Trigger updated_at |

---

## Grants EXECUTE

| Fonction | Granted to |
|----------|------------|
| `has_role(uuid, text)` | `authenticated` |
| `has_permission(uuid, text)` | `authenticated` |
| `admin_get_users()` | `authenticated` |
| `admin_reset_user_password(uuid)` | `authenticated` |
| `bootstrap_super_admin(uuid)` | `service_role` |
| `promote_to_admin(uuid)` | `service_role` |
| `set_updated_at()` | `service_role` |
| `handle_new_user()` | **REVOKE** `anon, authenticated, public` |

---

## RLS Policies (extrait)

### `profiles`
- `profiles_select_own` : `auth.uid() = id`
- `profiles_select_admin` : `has_role(auth.uid(), 'admin')`
- `profiles_select_super_admin` : `has_role(auth.uid(), 'super_admin')`
- `profiles_update_own` : `auth.uid() = id`
- `profiles_update_admin` / `super_admin` : `has_role(...)`
- `profiles_insert_admin` / `super_admin` : `has_role(...)`
- `profiles_delete_super_admin` : `has_role(auth.uid(), 'super_admin')`

### `roles` / `permissions` / `role_permissions`
- `*_select_all` : `to authenticated USING (true)`
- `*_manage_admin` / `*_manage_super_admin` : `has_role(auth.uid(), 'admin'/'super_admin')`

### `user_roles`
- `user_roles_select_own` : `auth.uid() = user_id`
- `user_roles_select_admin` / `super_admin` : `has_role(...)`
- `user_roles_insert_admin` / `super_admin` : `has_role(...) AND has_permission(..., 'users.change_role')`
- `user_roles_delete_admin` / `super_admin` : même condition

### Tables P1.3.2
- `role_delegations` : SELECT/MANAGE super_admin only
- `user_delegations` : SELECT super_admin + own (granter/grantee), MANAGE super_admin
- `role_assignability` : SELECT/MANAGE super_admin only

### `pages` / `features` / `page_features`
- SELECT : all authenticated (USING true)
- MANAGE : admin / super_admin

---

*Dernière mise à jour : 2026-09-15*