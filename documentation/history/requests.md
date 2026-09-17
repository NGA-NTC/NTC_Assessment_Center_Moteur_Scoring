---
id: HIST-REQUESTS-001
title: Historique des demandes
category: history
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - requests
  - history
  - decisions
---

# Historique des demandes

> Ce document retrace les demandes utilisateur majeures, leur analyse, les modifications effectuées et le résultat.

---

## REQ-20260911-001 : Mise en place base RBAC

**Demande :** Mettre en place le système RBAC de base (profils, rôles, permissions, user_roles) avec trigger auto-création profil + rôle candidate à l'inscription.

**Analyse :** Besoin de fondations RBAC solides avec trigger DB pour cohérence.

**Réponse OpenCode :** Création migration `20260911_p1_2_profiles_rbac.sql` avec tables `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, trigger `handle_new_user`, fonctions `has_role`/`has_permission`, RLS de base.

**Modifications :**
- Migration `20260911_p1_2_profiles_rbac.sql`
- Contextes `UserAuthContext`, `AdminAuthContext`
- Guards `UserRoute`, `ProtectedRoute`
- Pages `UserLogin`, `Register`, `Login`, `AdminResultats`, `TestApp`

**Validation :** Migration appliquée, tests manuels inscription/connexion OK.

**Références :** `MIG-20260911` dans [`history/migrations.md`](../migrations.md), [`architecture/authorization.md`](../architecture/authorization.md)

---

## REQ-20260911-002 : Sécurité + Super Admin

**Demande :** Correction sécurité (search_path, REVOKE EXECUTE) + ajout rôle `super_admin` avec bootstrap/promotion.

**Analyse :** Faille sécurité sur `search_path` + fonctions exécutables par anon. Besoin rôle racine pour bootstrap.

**Réponse OpenCode :** Migration `20260911210000_p1_2_1_security_fix.sql` : correction `search_path`, `REVOKE EXECUTE` sur sensibles, ajout `super_admin` + permissions, RPC `bootstrap_super_admin`/`promote_to_admin`, RLS `super_admin`, RPC `has_role`/`has_permission` sécurisées.

**Modifications :**
- Migration `20260911210000_p1_2_1_security_fix.sql`
- Suppression vue `user_with_roles`
- Fonctions `SECURITY DEFINER` + `SET search_path = public`
- `REVOKE EXECUTE` sur fonctions sensibles
- Rôle `super_admin` + 11 permissions
- RPC `bootstrap_super_admin`, `promote_to_admin`, `has_role`, `has_permission`

**Validation :** Migration appliquée, bootstrap super_admin testé via SQL Editor.

**Références :** `MIG-20260911210000` dans [`history/migrations.md`](../migrations.md)

---

## REQ-20260912-001 : Nettoyage Super Admin

**Demande :** Correction bootstrap (supprimer rôle candidate) + nettoyage super_admin existant.

**Analyse :** Bootstrap ajoute super_admin sans retirer candidate. User existant a les deux rôles.

**Réponse OpenCode :** Migration `20260912_p1_2_2_super_admin_cleanup.sql` : `bootstrap_super_admin` supprime candidate, nettoyage user `f34cd19c-1fc4-446a-9d22-cd30f57b27d4`.

**Validation :** Migration appliquée, user nettoyé.

**Références :** `MIG-20260912` dans [`history/migrations.md`](../migrations.md)

---

## REQ-20260913-001 : RPC Admin + Reset Password

**Demande :** RPC pour lister utilisateurs (remplace vue supprimée) + reset password admin via Edge Function.

**Analyse :** Vue `user_with_roles` supprimée pour sécurité. Besoin RPC sécurisée + reset password délégué à Edge Function (service_role).

**Réponse OpenCode :** Migration `20260913_p1_2_4_admin_rpc_edge.sql` : RPC `admin_get_users()` + `admin_reset_user_password()`, Edge Function `admin-reset-password` (Deno + service_role).

**Modifications :**
- Migration `20260913_p1_2_4_admin_rpc_edge.sql`
- Edge Function `supabase/functions/admin-reset-password/index.ts`
- Grants `EXECUTE` sur RPC → `authenticated`

**Validation :** RPC testées, Edge Function déployée, reset password testé.

**Références :** `MIG-20260913` dans [`history/migrations.md`](../migrations.md)

---

## REQ-20260914-001 : Pages & Fonctionnalités Super Admin

**Demande :** Interface Super Admin pour gérer pages, fonctionnalités, liaisons page↔feature.

**Analyse :** Besoin CRUD pages/features + liaison many-to-many + RLS + seed data routes réelles.

**Réponse OpenCode :** Migration `20260914_p1_2_5_pages_features.sql` : tables `pages`, `features`, `page_features` + RLS + seed data (13 pages, 41 features, 41 liaisons). Pages Super Admin (`SuperAdminPages`, `SuperAdminFeatures`).

**Modifications :**
- Migration `20260914_p1_2_5_pages_features.sql`
- Pages `SuperAdminPages.jsx`, `SuperAdminFeatures.jsx`
- Sidebar `SuperAdminSidebar.jsx` mise à jour

**Validation :** Migrations appliquées, CRUD testés, seed data présente.

**Références :** `MIG-20260914` dans [`history/migrations.md`](../migrations.md)

---

## REQ-20260915-001 : Extension RBAC (Hiérarchie + 4 Capacités + Traçabilité)

**Demande :** Extension RBAC pour hiérarchie rôles, 4 capacités (USE/MANAGE/GRANT/DELEGATE), traçabilité user_roles.

**Analyse :** Modèle actuel binaire (a permission / pas). Besoin granularité + hiérarchie info + audit trail.

**Réponse OpenCode :** Migration `20260915_p1_3_1_rbac_base_schema.sql` :
- `roles` : + `parent_id`, `hierarchy_level`, `is_assignable`
- `role_permissions` : + `can_use`, `can_manage`, `can_grant`, `can_delegate` (migration données → `can_use=true`)
- `user_roles` : `expires_at`, `revoked_at`, `revoked_by`

**Validation :** Migration appliquée, données migrées (`can_use=true` pour existants).

**Références :** `MIG-20260915` dans [`history/migrations.md`](../migrations.md), [`architecture/authorization.md`](../architecture/authorization.md)

---

## REQ-20260915-002 : Schéma Délégation Complète

**Demande :** Structure complète délégation (rôle→rôle, user→user, assignabilité) + RLS + indexes.

**Analyse :** Besoin délégation standard (rôle→rôle) + exception (user→user) + contrôle attribution rôles.

**Réponse OpenCode :** Migration `20260915165400_p1_3_2_delegation_schema.sql` :
- `role_delegations` (rôle→rôle, use/manage/grant, scopes, traçabilité)
- `user_delegations` (user→user, exception, reason, pas redélégation)
- `role_assignability` (PK composite, anti-self)

**Contraintes clés :** `delegation_type` ∈ (use,manage,grant) — PAS `delegate`; scopes (global/role/user/self); anti-self; temporel.

**RLS :** Super Admin only (delegations), Super Admin + own (user_delegations).

**Validation :** Migration appliquée, tables créées, RLS actives, indexes créés.

**Références :** `MIG-20260915165400` dans [`history/migrations.md`](../migrations.md), [`architecture/delegation.md`](../architecture/delegation.md)

---

## REQ-20260915-003 : Documentation Architecture Finale

**Demande :** Documentation complète architecture (RBAC + délégation + accès public + sécurité) avant implémentation RPC.

**Analyse :** Besoin valider conception avant implémentation RPC moteur autorité effective.

**Réponse OpenCode :** Document de conception consolidé (P1.3.3) avec corrections :
1. `delegation_type` = use/manage/grant (pas delegate)
2. `hierarchy_level` pas preuve d'autorité
3. `user_delegations` sans `created_by` (granter_user_id = créateur)
4. Fusion autorités (pas écrasement)
5. `ASSIGN_ROLE` = capacité + assignability + scope

**Livrable :** Document de conception finalisé (P1.3.3), prêt pour P1.3.4 (RPC).

**Références :** [`architecture/delegation.md`](../architecture/delegation.md), [`architecture/authorization.md`](../architecture/authorization.md), [`architecture/access-audience.md`](../architecture/access-audience.md)

---

## REQ-20260915-004 : Documentation Projet Complète

**Demande :** Création documentation complète projet (architecture, guides, référence, historique, décisions, roadmap).

**Analyse :** Besoin base documentaire structurée, Markdown + YAML frontmatter, source de vérité unique.

**Réponse OpenCode :** Création structure `documentation/` complète :
- `README.md` (point entrée)
- `architecture/` (8 docs)
- `guides/` (4 docs)
- `reference/` (5 docs)
- `history/` (4 docs)
- `decisions/` (3 ADR)
- `versions/` (1 doc)
- `roadmap/` (1 doc)

**Validation :** Structure créée, fichiers rédigés, frontmatter YAML cohérent, liens internes relatifs.

**Références :** Ce document + tous fichiers `documentation/**/*.md`

---

*Dernière mise à jour : 2026-09-15*