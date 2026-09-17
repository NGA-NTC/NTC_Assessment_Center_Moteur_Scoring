---
id: HIST-MIGRATIONS-001
title: Historique des migrations
category: history
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - migrations
  - history
  - database
---

# Historique des migrations

## Vue d'ensemble

| # | Fichier | Date | Description | Statut |
|---|---------|------|-------------|--------|
| 1 | `20260909213412_ntc_initial_schema.sql` | 2026-09-09 | Schéma initial (vide) | APPLIED |
| 2 | `20260911_p1_2_profiles_rbac.sql` | 2026-09-11 | Profils, RBAC base, trigger handle_new_user | APPLIED |
| 3 | `20260911210000_p1_2_1_security_fix.sql` | 2026-09-11 | Security fix, super_admin, RPC, bootstrap | APPLIED |
| 4 | `20260912_p1_2_2_super_admin_cleanup.sql` | 2026-09-12 | Nettoyage bootstrap super_admin | APPLIED |
| 5 | `20260913_p1_2_4_admin_rpc_edge.sql` | 2026-09-13 | RPC admin + Edge Function reset password | APPLIED |
| 6 | `20260914_p1_2_5_pages_features.sql` | 2026-09-14 | Tables pages, features, page_features + RLS + seed | APPLIED |
| 7 | `20260915_p1_3_1_rbac_base_schema.sql` | 2026-09-15 | Extension RBAC (hiérarchie, 4 capacités, traçabilité) | APPLIED |
| 8 | `20260915165400_p1_3_2_delegation_schema.sql` | 2026-09-15 | Délégations (role_delegations, user_delegations, role_assignability) | APPLIED |

---

## Détail par migration

### MIG-20260911 — P1.2 Profils & RBAC Base

**Fichier :** `20260911_p1_2_profiles_rbac.sql`

**Objectif :** Créer les fondations RBAC (profils, rôles, permissions, user_roles) + trigger auto-création profil + rôle candidate.

**Tables créées :**
- `profiles` (id, email, first_name, last_name, phone, avatar_url, linkedin_url, job_title, location, bio, status, created_at, updated_at)
- `roles` (id, name, description, is_system, created_at, updated_at)
- `permissions` (id, name, description, category)
- `role_permissions` (role_id, permission_id) — PK composite
- `user_roles` (user_id, role_id, assigned_by, assigned_at) — PK composite

**Fonctions :**
- `set_updated_at()` — trigger updated_at
- `has_role(user_id, role_text)` — vérification rôle
- `has_permission(user_id, perm_text)` — vérification permission via rôles
- `handle_new_user()` — trigger auth.users insert → profil + rôle candidate

**RLS :**
- `profiles` : select own/admin, update own/admin, insert admin, delete —
- `roles/permissions/role_permissions` : select all authenticated, manage admin
- `user_roles` : select own/admin, insert/delete admin + perm `users.change_role`

**Trigger :** `on_auth_user_created` AFTER INSERT ON auth.users → `handle_new_user()`

**Données seed :**
- Rôles : `candidate`, `admin`
- Permissions : 11 permissions (users.*, profile.*, assessment.*, results.*)
- Attribution permissions : candidate (3), admin (8)

---

### MIG-20260911210000 — P1.2.1 Security Fix + Super Admin

**Fichier :** `20260911210000_p1_2_1_security_fix.sql`

**Objectif :** Corrections sécurité + ajout rôle `super_admin` + RPC sécurisées + bootstrap/promotion.

**Changements clés :**
1. Suppression vue `user_with_roles` (problématique)
2. Sécurisation fonctions : `set_updated_at`, `has_role`, `has_permission` → `SECURITY DEFINER` + `SET search_path = public`
3. `handle_new_user()` : `REVOKE EXECUTE` sur `anon, authenticated, public`
4. **Ajout rôle `super_admin`** + permissions étendues (`users.promote_admin`, `users.promote_super_admin`)
5. RLS `super_admin` sur toutes tables sensibles
6. **RPC :**
   - `bootstrap_super_admin(target_user_id)` — bootstrap unique super_admin (SECURITY DEFINER, service_role only)
   - `promote_to_admin(target_user_id)` — promotion admin par super_admin (SECURITY DEFINER, service_role only)
   - `has_role(uuid, text)`, `has_permission(uuid, text)` — pour RLS/RPC
7. `REVOKE EXECUTE` sur fonctions sensibles (`bootstrap_super_admin`, `promote_to_admin`, `set_updated_at`, `handle_new_user`) pour `anon, authenticated, public`
8. `GRANT EXECUTE` sur `has_role`, `has_permission` → `authenticated`

**Données seed :**
- Rôle `super_admin` + 2 permissions (`users.promote_admin`, `users.promote_super_admin`)
- 11 permissions `role_permissions` pour `super_admin`

---

### MIG-20260912 — P1.2.2 Super Admin Cleanup

**Fichier :** `20260912_p1_2_2_super_admin_cleanup.sql`

**Objectif :** Correction `bootstrap_super_admin` (supprime rôle candidate) + nettoyage user existant.

**Changements :**
1. `bootstrap_super_admin` : ajoute `DELETE FROM user_roles WHERE user_id = target_user_id AND role_id = 'candidate'`
2. Nettoyage user existant : `DELETE FROM user_roles WHERE user_id = 'f34cd19c-1fc4-446a-9d22-cd30f57b27d4' AND role_id = 'candidate'`

---

### MIG-20260913 — P1.2.4 Admin RPC + Edge Function

**Fichier :** `20260913_p1_2_4_admin_rpc_edge.sql`

**Objectif :** RPC `admin_get_users` (remplace vue supprimée) + RPC `admin_reset_user_password` + Edge Function `admin-reset-password`.

**RPC créées :**
1. `admin_get_users()` → `jsonb` — Liste users + profils + rôles (check admin/super_admin)
2. `admin_reset_user_password(target_user_id uuid)` — Vérif perm `users.change_role`, autorise reset via Edge Function

**Edge Function :** `admin-reset-password` (Deno)
- Vérif token + perm `users.change_role` via RPC `has_permission`
- Service Role → `auth.admin.generateLink(type: 'recovery')`

**Grants :** `EXECUTE` sur `admin_get_users`, `admin_reset_user_password` → `authenticated`

---

### MIG-20260914 — P1.2.5 Pages & Features

**Fichier :** `20260914_p1_2_5_pages_features.sql`

**Objectif :** Tables `pages`, `features`, `page_features` + RLS + seed data.

**Tables :**
- `pages` (id, name, path, description, icon, is_system, access_audience, access_permission)
- `features` (id, name, description, page_id, category, is_system, access_audience, access_permission, access_scope_type, access_scope_value)
- `page_features` (page_id, feature_id) — PK composite

**RLS :**
- `pages` : SELECT all authenticated, MANAGE admin/super_admin
- `features` : SELECT all authenticated, MANAGE admin/super_admin
- `page_features` : SELECT all authenticated, MANAGE admin/super_admin

**Seed data (27 pages + 41 features + 41 liaisons) :**
- Pages publiques (5), Admin (2), Super Admin (7)
- Features par page (navigation, assessment, results, users, permissions, pages, analytics, export, import, test, security)

---

### MIG-20260915 — P1.3.1 RBAC Base Schema Extension

**Fichier :** `20260915_p1_3_1_rbac_base_schema.sql`

**Objectif :** Extension schéma RBAC pour hiérarchie + 4 capacités + traçabilité.

**Changements :**
1. `roles` : + `parent_id` (FK self), `hierarchy_level` (int default 0), `is_assignable` (bool default true)
2. `role_permissions` : + `can_use`, `can_manage`, `can_grant`, `can_delegate` (bool default false)
   - Migration données : `UPDATE ... SET can_use = true WHERE all false`
4. `user_roles` : + `expires_at`, `revoked_at`, `revoked_by` (FK auth.users SET NULL)
4. Index : `roles_parent_id_idx`, `user_roles_expires_at_idx`, `user_roles_revoked_at_idx`

**Commentaire important :** `parent_id`, `hierarchy_level`, `is_assignable` = infos structurelles **pas preuve d'autorité**.

---

### MIG-20260915165400 — P1.3.2 Delegation Schema

**Fichier :** `20260915165400_p1_3_2_delegation_schema.sql`

**Objectif :** Structure complète délégation (rôle→rôle, user→user, assignabilité).

**Tables créées :**
1. `role_delegations` — délégation rôle→rôle (use/manage/grant, scopes, traçabilité)
2. `user_delegations` — délégation user→user (exception, reason, pas de redélégation auto)
3. `role_assignability` — quels rôles un rôle peut attribuer (PK composite)

**Contraintes clés :**
- `delegation_type` ∈ (`use`, `manage`, `grant`) — **PAS `delegate`**
- `scope_type` ∈ (`global`, `role`, `user`, `self`)
- Anti-self : `delegator != target`, `granter != grantee`, `assigner != assignable`
- Temporel : `expires_at > created_at`, `revoked_at >= created_at`
- FK RESTRICT sur rôles/permissions, SET NULL sur `revoked_by`

**RLS :**
- `role_delegations` : Super Admin only
- `user_delegations` : Super Admin + parties concernées (granter/grantee)
- `role_assignability` : Super Admin only

**Indexes :** 13 indexes sur FK + dates expiration/révocation

---

## Validation

Toutes migrations appliquées sur Supabase distant (vérifié via `supabase migration list`).

| Migration | Remote | Local | Statut |
|-----------|--------|-------|--------|
| 20260909213412 | ✅ | ✅ | APPLIED |
| 20260911 | ✅ | ✅ | APPLIED |
| 20260911210000 | ✅ | ✅ | APPLIED |
| 20260912 | ✅ | ✅ | APPLIED |
| 20260913 | ✅ | ✅ | APPLIED |
| 20260914 | ✅ | ✅ | APPLIED |
| 20260915 | ✅ | ✅ | APPLIED |
| 20260915165400 | ✅ | ✅ | APPLIED |

---

*Dernière mise à jour : 2026-09-15*