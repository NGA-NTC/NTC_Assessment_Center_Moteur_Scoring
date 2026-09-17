---
id: HIST-CODE-CHANGES-001
title: Historique des changements de code
category: history
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - code-changes
  - history
  - refactoring
---

# Historique des changements de code

> Ce document trace les modifications importantes apportées au codebase. Il référence les documents d'architecture pour les détails techniques.

---

## Par domaine fonctionnel

### Authentification & Contextes

| Période | Changement | Fichiers | Référence archi |
|---------|------------|----------|-----------------|
| P1.2 | Création `UserAuthContext` + `AdminAuthContext` | `src/context/*.jsx` | [`architecture/authentication.md`](../../architecture/authentication.md) |
| P1.2.1 | Ajout `hasRole('super_admin')` guard | `SuperAdminRoute.jsx` | [`architecture/frontend.md`](../../architecture/frontend.md#guards) |
| P1.3.1 | `UserAuthContext` expose `roles` + `permissions` (4 capacités) | `UserAuthContext.jsx` | [`architecture/authorization.md`](../../architecture/authorization.md) |

### Routing & Guards

| Période | Changement | Fichiers |
|---------|------------|----------|
| P1.2 | Routes de base + `UserRoute`/`ProtectedRoute` | `routes/index.jsx`, `ProtectedRoute.jsx`, `UserRoute.jsx` |
| P1.3 | Ajout routes Super Admin (`/super-admin/*`) | `routes/index.jsx` |
| P1.3 | `SuperAdminRoute` + `SuperAdminLayout` | `SuperAdminRoute.jsx`, `SuperAdminLayout.jsx` |

### Pages Super Admin (P1.3)

| Page | Fichier | Fonctionnalité | Migration associée |
|------|---------|----------------|-------------------|
| Dashboard | `SuperAdminDashboard.jsx` | Stats + activité + actions rapides | P1.3.1 |
| Comptes | `SuperAdminAccounts.jsx` | CRUD users + rôles + MDP | P1.3.1 + P1.3.2 |
| Rôles | `SuperAdminRoles.jsx` | CRUD rôles + permissions | P1.3.1 |
| Accès | `SuperAdminAccess.jsx` | Délégations + permissions | P1.3.2 |
| Pages | `SuperAdminPages.jsx` | CRUD pages | P1.2.5 |
| Fonctionnalités | `SuperAdminFeatures.jsx` | CRUD features | P1.2.5 |

### Module Admin (Résultats)

| Période | Changement | Fichiers |
|---------|------------|----------|
| P1.2 | `AdminResultats.jsx` complet | Liste, filtres, détail, export PDF/JSON, import, création compte |
| P1.2.4 | Import JSON + création compte | `AdminResultats.jsx` + `storage.js` |
| P1.3 | Intégration Super Admin | `AdminResultats.jsx` (bouton retour Super Admin) |

### Module Test (Candidat)

| Période | Changement | Fichiers |
|---------|------------|----------|
| P1.2 | `TestApp.jsx` + batteries (8) | `TestApp.jsx`, `components/question/*` |
| P1.2 | Sidebar adaptive (candidat/admin/super_admin) | `TestApp.jsx`, `Sidebar.jsx`, `SuperAdminSidebar.jsx` |

### Composants UI & Layout

| Période | Changement | Fichiers |
|---------|------------|----------|
| P1.2 | Design system `theme.js` + composants UI | `lib/theme.js`, `components/ui/*` |
| P1.2 | `AppShell`, `Sidebar`, `AdminSidebar`, `UserAvatar` | `components/layout/*` |
| P1.3 | `SuperAdminSidebar`, `SuperAdminLayout` | `components/layout/*` |

### Module Test (Batteries)

| Batterie | Type | Composant | Items |
|----------|------|-----------|-------|
| B1 | `correct` | `McqBattery` | 32 |
| B2 | `weighted` | `McqBattery` | 28 |
| B3 | `weighted` | `McqBattery` | 30 |
| B4 | `weighted` | `McqBattery` | 28 |
| B5 | `weighted` | `McqBattery` | 32 |
| B6 | `weighted` | `McqBattery` | 28 |
| B7 | `rubric` | `RubricBattery` | 9 cas |
| B8 | `coherence` | `CoherenceBattery` | 10 sims |

### Scoring & Export

| Module | Fichier | Fonction |
|--------|---------|----------|
| Scoring | `lib/scoring.js` | 44 dims, 8 axes, 5 métiers, cohérence |
| Export | `lib/export.js` | PDF (print) + JSON |
| Import | `lib/storage.js` + `lib/imported.js` | JSON → localStorage |
| Candidates | `lib/candidates.js` | Agrégation + scoring |

### Stockage local (`storage.js`)

| Clé | Contenu |
|-----|---------|
| `ntc_users` | Comptes candidats + réponses |
| `ntc_imported` | Imports JSON + métadonnées |
| `ntc_auth` | Session admin |
| `ntc_user_session` | Session candidat |

### Supabase Client & RPC

| Période | Ajout | Fichier |
|---------|-------|---------|
| P1.2 | `supabaseClient.js` | `lib/supabaseClient.js` |
| P1.2.4 | RPC `admin_get_users`, `admin_reset_user_password` | Migration `20260913...` |
| P1.2.4 | Edge Function `admin-reset-password` | `functions/admin-reset-password/` |
| P1.3 | RPC `has_role`, `has_permission` (secure) | Migration `20260911210000` |
| P1.3 | RPC `bootstrap_super_admin`, `promote_to_admin` | Migration `20260911210000` |

### Migrations SQL (chronologique)

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `20260909213412_ntc_initial_schema.sql` | Vide (placeholder) |
| 2 | `20260911_p1_2_profiles_rbac.sql` | Profils, RBAC base, trigger |
| 3 | `20260911210000_p1_2_1_security_fix.sql` | Security fix + super_admin + RPC |
| 4 | `20260912_p1_2_2_super_admin_cleanup.sql` | Nettoyage bootstrap |
| 5 | `20260913_p1_2_4_admin_rpc_edge.sql` | RPC admin + Edge Function |
| 6 | `20260914_p1_2_5_pages_features.sql` | Pages + Features + seed |
| 7 | `20260915_p1_3_1_rbac_base_schema.sql` | Extension RBAC (hiérarchie, 4 caps) |
| 8 | `20260915165400_p1_3_2_delegation_schema.sql` | Délégations + assignability |

---

## Refactoring notables

| Date | Zone | Description |
|------|------|-------------|
| P1.2.1 | Security fix | `SECURITY DEFINER` + `search_path` sur toutes fonctions, `REVOKE EXECUTE` sur sensibles |
| P1.2.4 | RPC `admin_get_users` | Remplace vue `user_with_roles` supprimée |
| P1.3.1 | `role_permissions` | Ajout 4 colonnes `can_use/manage/grant/delegate` + migration données |
| P1.3.1 | `roles` | Ajout `parent_id`, `hierarchy_level`, `is_assignable` |
| P1.3.1 | `user_roles` | Ajout `expires_at`, `revoked_at`, `revoked_by` |
| P1.3.2 | Nouvelles tables | `role_delegations`, `user_delegations`, `role_assignability` |

---

*Dernière mise à jour : 2026-09-15*