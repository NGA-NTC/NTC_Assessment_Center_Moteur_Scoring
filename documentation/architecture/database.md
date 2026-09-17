---
id: ARCH-DATABASE-001
title: Base de données - Schéma et tables
category: architecture
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - database
  - postgresql
  - schema
  - tables
---

# Base de données - Schéma et tables

## Vue d'ensemble

Schéma `public` sur PostgreSQL (Supabase). Toutes les tables ont RLS activé.

---

## Tables principales

### 1. `profiles`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | Identifiant = auth.users.id |
| `email` | `text` | NOT NULL | Email (copie de auth.users) |
| `first_name` | `text` | NULLABLE | Prénom |
| `last_name` | `text` | NULLABLE | Nom |
| `phone` | `text` | NULLABLE | Téléphone |
| `avatar_url` | `text` | NULLABLE | URL avatar |
| `linkedin_url` | `text` | NULLABLE | URL LinkedIn |
| `job_title` | `text` | NULLABLE | Poste |
| `location` | `text` | NULLABLE | Localisation |
| `bio` | `text` | NULLABLE | Biographie |
| `status` | `text` | NOT NULL DEFAULT 'active', CHECK ∈ ('active','inactive','suspended') | Statut compte |
| `created_at` | `timestamptz` | DEFAULT now() | Création |
| `updated_at` | `timestamptz` | DEFAULT now() | MAJ (trigger) |

**Indexes :** `profiles_email_idx`, `profiles_status_idx`

**RLS :** select own/admin/super_admin, update own/admin/super_admin, insert admin/super_admin, delete super_admin

---

### 2. `roles`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `text` | PK | Identifiant unique (ex: `candidate`, `admin`, `super_admin`) |
| `name` | `text` | NOT NULL | Label affiché |
| `description` | `text` | NULLABLE | Description |
| `is_system` | `boolean` | DEFAULT false | Rôle système (non supprimable) |
| `parent_id` | `text` | FK → `roles(id)` ON DELETE SET NULL | Parent hiérarchique |
| `hierarchy_level` | `int` | DEFAULT 0 | Niveau hiérarchique (info only) |
| `is_assignable` | `boolean` | DEFAULT true | Peut être attribué |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | DEFAULT now() | Trigger |

**Index :** `roles_parent_id_idx`

**Données initiales (migrations) :**
```sql
('candidate', 'Candidat', 'Utilisateur passant les assessments', true),
('admin', 'Administrateur', 'Accès complet à l''administration', true),
('super_admin', 'Super Administrateur', 'Propriétaire du système', true)
```

> **Note** : `parent_id`, `hierarchy_level`, `is_assignable` ajoutés par migration `P1.3.1`. Sont des **informations structurelles**, PAS une preuve d'autorité.

---

### 3. `permissions`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `text` | PK | Identifiant unique (ex: `users.view`) |
| `name` | `text` | NOT NULL | Label affiché |
| `description` | `text` | NULLABLE | Description |
| `category` | `text` | DEFAULT 'general' | Catégorie (users, profile, assessment, results...) |
| `created_at` | `timestamptz` | DEFAULT now() | |

**Données initiales (catégories) :**
- `users` : `users.view`, `users.edit`, `users.manage`, `users.change_role`, `users.promote_admin`, `users.promote_super_admin`
- `profile` : `profile.view`, `profile.edit`
- `assessment` : `assessment.take`, `assessment.evaluate`
- `results` : `results.view`, `reports.view`

---

### 4. `role_permissions`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `role_id` | `text` | PK, FK → `roles(id)` ON DELETE CASCADE | |
| `permission_id` | `text` | PK, FK → `permissions(id)` ON DELETE CASCADE | |
| `can_use` | `boolean` | DEFAULT false | Capacité USE |
| `can_manage` | `boolean` | DEFAULT false | Capacité MANAGE |
| `can_grant` | `boolean` | DEFAULT false | Capacité GRANT |
| `can_delegate` | `boolean` | DEFAULT false | Capacité DELEGATE |

**PK composite :** `(role_id, permission_id)`

**FK :** `role_id → roles(id)` CASCADE, `permission_id → permissions(id)` CASCADE

**Migration données existantes (P1.3.1) :**
```sql
UPDATE role_permissions SET can_use = true
WHERE can_use = false AND can_manage = false AND can_grant = false AND can_delegate = false;
```
→ Toutes permissions existantes = `can_use = true` (comportement historique)

> **Important** : Les 4 capacités (USE, MANAGE, GRANT, DELEGATE) sont **INDÉPENDANTES**. Aucune inclusion automatique.

---

### 5. `user_roles`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `user_id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | |
| `role_id` | `text` | PK, FK → `roles(id)` ON DELETE CASCADE | |
| `assigned_by` | `uuid` | FK → `auth.users(id)` | Qui a attribué |
| `assigned_at` | `timestamptz` | DEFAULT now() | |
| `expires_at` | `timestamptz` | NULLABLE | Expiration rôle (P1.3.1) |
| `revoked_at` | `timestamptz` | NULLABLE | Révocation (P1.3.1) |
| `revoked_by` | `uuid` | FK → `auth.users(id)` ON DELETE SET NULL | Qui a révoqué (P1.3.1) |

**PK composite :** `(user_id, role_id)`

**Indexes :** `user_roles_user_id_idx`, `user_roles_role_id_idx`, `user_roles_expires_at_idx`, `user_roles_revoked_at_idx`

**RLS :**
- SELECT own / admin / super_admin
- INSERT/DELETE admin + perm `users.change_role` / super_admin + perm

**Trigger auto-création :** `handle_new_user()` → insère `candidate` par défaut.

---

### 6. `pages`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `text` | PK | Identifiant (ex: `dashboard`, `super-admin`) |
| `name` | `text` | NOT NULL | Label affiché |
| `path` | `text` | NOT NULL | Route URL |
| `description` | `text` | NULLABLE | Description |
| `icon` | `text` | NULLABLE | Nom icône Lucide |
| `is_system` | `boolean` | DEFAULT false | Page système (non supprimable) |
| `access_audience` | `text` | NOT NULL DEFAULT 'authenticated', CHECK ∈ ('public','authenticated','role_based') | Politique d'accès |
| `access_permission` | `text` | FK → `permissions(id)` NULLABLE | Permission requise si role_based |
| `created_at` / `updated_at` | `timestamptz` | DEFAULT now() | |

**Indexes :** `pages_name_idx`, `pages_path_idx`

**RLS :** SELECT all authenticated (pas `public` !), MANAGE admin/super_admin

**Données initiales (13 pages) :** dashboard, test, results, profile, password, admin-dashboard, admin-users, super-admin, super-admin-accounts, super-admin-roles, super-admin-access, super-admin-pages, super-admin-features

---

### 7. `features`

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `text` | PK | Identifiant (ex: `dashboard-view`) |
| `name` | `text` | NOT NULL | Label |
| `description` | `text` | NULLABLE | |
| `page_id` | `text` | NOT NULL, FK → `pages(id)` ON DELETE CASCADE | Page parente |
| `category` | `text` | NULLABLE | Catégorie (navigation, assessment, results, users, permissions, pages, analytics, export, import, test, security) |
| `is_system` | `boolean` | DEFAULT false | Système |
| `access_audience` | `text` | NOT NULL DEFAULT 'role_based', CHECK ∈ ('public','authenticated','role_based') | Politique d'accès propre |
| `access_permission` | `text` | FK → `permissions(id)` NULLABLE | Permission si role_based |
| `access_scope_type` | `text` | CHECK ∈ ('global','role','user','self') NULLABLE | Scope requis |
| `access_scope_value` | `text` | NULLABLE | Valeur scope (ex: `role:encadreur`) |
| `created_at` / `updated_at` | `timestamptz` | DEFAULT now() | |

**Indexes :** `features_page_id_idx`, `features_name_idx`

**RLS :** SELECT all authenticated, MANAGE admin/super_admin

> **Important** : `access_audience` propre à la feature. Une feature `role_based` sur page `public` ne rend PAS la page protégée.

---

### 8. `page_features` (liaison many-to-many)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `page_id` | `text` | PK, FK → `pages(id)` ON DELETE CASCADE |
| `feature_id` | `text` | PK, FK → `features(id)` ON DELETE CASCADE |

**PK composite :** `(page_id, feature_id)`

**Indexes :** `page_features_page_id_idx`, `page_features_feature_id_idx`

**RLS :** SELECT all authenticated, MANAGE admin/super_admin

---

### 9. `role_delegations` (P1.3.2)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `delegator_role_id` | `text` | NOT NULL, FK → `roles(id)` ON DELETE RESTRICT | Rôle délégateur |
| `target_role_id` | `text` | NOT NULL, FK → `roles(id)` ON DELETE RESTRICT | Rôle bénéficiaire |
| `permission_id` | `text` | NOT NULL, FK → `permissions(id)` ON DELETE RESTRICT | Permission déléguée |
| `delegation_type` | `text` | NOT NULL, CHECK ∈ ('use','manage','grant') | Niveau délégué |
| `scope_type` | `text` | NOT NULL DEFAULT 'global', CHECK ∈ ('global','role','user','self') | Portée |
| `scope_value` | `text` | NULLABLE | Valeur scope (ex: `role:encadreur`) |
| `created_by` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE RESTRICT | Auteur |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `expires_at` | `timestamptz` | NULLABLE | Expiration |
| `revoked_at` | `timestamptz` | NULLABLE | Révocation |
| `revoked_by` | `uuid` | FK → `auth.users(id)` ON DELETE SET NULL | Révocateur |

**FK :** RESTRICT sur rôles/permissions, SET NULL sur revoked_by

**CHECK constraints :**
- `delegation_type` ∈ ('use','manage','grant') — **PAS 'delegate'**
- `scope_type` ∈ ('global','role','user','self')
- `delegator_role_id != target_role_id` (anti-self)
- `expires_at > created_at` / `revoked_at >= created_at`

**Indexes :** delegator_role_id, target_role_id, permission_id, expires_at, revoked_at

**RLS :** SELECT/MANAGE super_admin uniquement

---

### 10. `user_delegations` (P1.3.2)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() |
| `granter_user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` RESTRICT |
| `grantee_user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` RESTRICT |
| `permission_id` | `text` | NOT NULL, FK → `permissions(id)` RESTRICT |
| `delegation_type` | `text` | NOT NULL, CHECK ∈ ('use','manage','grant') |
| `scope_type` | `text` | NOT NULL DEFAULT 'global', CHECK ∈ ('global','role','user','self') |
| `scope_value` | `text` | NULLABLE |
| `reason` | `text` | NULLABLE (justification obligatoire pour exception) |
| `created_at` | `timestamptz` | DEFAULT now() |
| `expires_at` / `revoked_at` | `timestamptz` | NULLABLE |
| `revoked_by` | `uuid` | FK → `auth.users(id)` SET NULL |

**CHECK :** `granter_user_id != grantee_user_id`, `expires_at > created_at`, `revoked_at >= created_at`

**RLS :** SELECT super_admin + granter/grantee, MANAGE super_admin

> **Note** : `created_by` n'existe PAS sur cette table (seulement `granter_user_id`). Le grantor = créateur.

---

### 11. `role_assignability` (P1.3.2)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `assigner_role_id` | `text` | PK, FK → `roles(id)` RESTRICT |
| `assignable_role_id` | `text` | PK, FK → `roles(id)` RESTRICT |
| `created_by` | `uuid` | NOT NULL, FK → `auth.users(id)` RESTRICT |
| `created_at` | `timestamptz` | DEFAULT now() |

**PK composite :** `(assigner_role_id, assignable_role_id)`

**CHECK :** `assigner_role_id != assignable_role_id` (anti-self)

**Indexes :** `assigner_role_id`, `assignable_role_id`

**RLS :** SELECT/MANAGE super_admin uniquement

> **Note** : Table déclarative seulement. Ne donne PAS de droit effectif. Nécessite capacité effective `ASSIGN_ROLE` + scope.

---

## Relations résumées

```
roles (parent_id) ─────► roles (id)          -- Hiérarchie (info only)
roles ──────► role_permissions ◄────── permissions
roles ──────► role_delegations (delegator)   -- Délégation sortante
roles ──────► role_delegations (target)      -- Délégation entrante
roles ──────► role_assignability (assigner)  -- Peut attribuer
roles ──────► role_assignability (assignable)-- Peut être attribué

users ──────► user_roles ◄────── roles
users ──────► user_delegations (granter)     -- Délégation sortante
users ──────► user_delegations (grantee)     -- Délégation entrante

pages ──────► page_features ◄────── features
pages (parent_id) ─────► pages (id)          -- Optionnel, structure

features ──────► pages (page_id)
```

---

## Données seed (référence)

### Rôles système
- `candidate` (is_system=true)
- `admin` (is_system=true)
- `super_admin` (is_system=true)

### Permissions (extrait)
| ID | Catégorie |
|----|-----------|
| users.view | users |
| users.edit | users |
| users.manage | users |
| users.change_role | users |
| users.promote_admin | users |
| users.promote_super_admin | users |
| profile.view | profile |
| profile.edit | profile |
| assessment.take | assessment |
| assessment.evaluate | assessment |
| results.view | results |
| reports.view | reports |

### Pages (13)
- `dashboard` → `/` (public)
- `test` → `/test` (authenticated)
- `results` → `/resultats` (authenticated)
- `profile` → `/compte` (authenticated)
- `password` → `/modifier-mot-de-passe` (authenticated)
- `admin-dashboard` → `/admin` (role_based)
- `admin-users` → `/admin/utilisateurs` (role_based)
- `super-admin` → `/super-admin` (role_based)
- `super-admin-accounts` → `/super-admin/comptes` (role_based)
- `super-admin-roles` → `/super-admin/roles` (role_based)
- `super-admin-access` → `/super-admin/acces` (role_based)
- `super-admin-pages` → `/super-admin/pages` (role_based)
- `super-admin-features` → `/super-admin/fonctionnalites` (role_based)

---

*Dernière mise à jour : 2026-09-15*