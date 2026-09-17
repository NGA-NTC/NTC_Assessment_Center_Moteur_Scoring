---
id: ROADMAP-001
title: Feuille de route (Roadmap)
category: roadmap
status: designed
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - roadmap
  - planning
  - future
---

# Feuille de route (Roadmap)

> **Légende** : `IMPLEMENTED` = implémenté | `DESIGNED` = conçu/documenté | `PLANNED` = prévu | `UNKNOWN` = incertain

---

## Vue d'ensemble par phase

| Phase | Nom | Période | Statut | Focus |
|-------|-----|---------|--------|-------|
| P1.1 | Initialisation | 2026-09-09 | ✅ IMPLEMENTED | Projet Vite + React + Supabase |
| P1.2 | RBAC & Auth Base | 2026-09-11 à 2026-09-14 | ✅ IMPLEMENTED | RBAC, Auth, Admin, Pages/Features |
| P1.3 | RBAC Étendu + Délégation | 2026-09-15 | ✅ IMPLEMENTED (schéma) / DESIGNED (moteur) | Hiérarchie, 4 capacités, Délégation |
| P1.4 | Résultats & Audit | Q4 2026 | PLANNED | Migration résultats localStorage → Supabase |
| P1.5 | Comptes & Import | Q4 2026 | PLANNED | Création comptes via Edge Function, Import JSON → Supabase |
| P2.0 | Production Ready | Q1 2027 | PLANNED | Tests, monitoring, hardening, docs |

---

## Détail par phase

---

### P1.3 — RBAC Étendu + Délégation (En cours)

| Tâche | Statut | Détails |
|-------|--------|---------|
| **P1.3.1** Extension schéma RBAC | ✅ IMPLEMENTED | Migration `20260915_p1_3_1_rbac_base_schema.sql` : `roles` (hiérarchie), `role_permissions` (4 capacités), `user_roles` (traçabilité) |
| **P1.3.2** Schéma délégation | ✅ IMPLEMENTED | Migration `20260915165400` : `role_delegations`, `user_delegations`, `role_assignability` + RLS + indexes |
| **P1.3.3** Conception moteur autorité | ✅ DESIGNED | Doc `architecture/delegation.md` + `authorization.md` + `access-audience.md` (corrigé P1.3.3) |
| **P1.3.4** Implémentation RPC moteur | **PLANNED** | RPC `get_effective_authority`, `has_effective_permission`, mutations délégation/attribution |
| **P1.3.5** Intégration frontend Super Admin | PLANNED | Brancher UI SuperAdminAccounts/Roles/Access/Pages/Features sur RPC |

#### P1.3.4 — RPC Moteur d'autorité (PROCHAINE ÉTAPE)

| RPC | Type | Priorité |
|-----|------|----------|
| `get_effective_authority(user_id, perm?, scope_type?, scope_value?)` | Lecture | 🔴 Critique |
| `has_effective_permission(user_id, perm, capability, scope_type, scope_value)` | Booléen | 🔴 Critique |
| `has_effective_capability(user_id, capability, scope_type, scope_value)` | Booléen | 🔴 Critique |
| `get_assignable_roles(user_id)` | Lecture | 🟡 Haute |
| `can_user_assign_role(user_id, target_role_id)` | Booléen | 🟡 Haute |
| `grant_role_to_user(granter_id, target_user_id, role_id)` | Mutation | 🔴 Critique |
| `revoke_role_from_user(granter_id, target_user_id, role_id)` | Mutation | 🟡 Haute |
| `create_role_delegation(...)` | Mutation | 🟡 Haute |
| `create_user_delegation(...)` | Mutation | 🟡 Haute |
| `revoke_role_delegation(granter_id, delegation_id)` | Mutation | 🟢 Moyenne |
| `revoke_user_delegation(granter_id, delegation_id)` | Mutation | 🟢 Moyenne |

---

### P1.4 — Résultats & Audit (Q4 2026)

| Tâche | Statut | Détails |
|-------|--------|---------|
| Tables résultats (`assessment_sessions`, `candidate_responses`, `scores`) | PLANNED | Migration + RLS |
| Migration `ntc_users` + `ntc_imported` → Supabase | PLANNED | Script one-shot + validation |
| Table `audit_log` + triggers | PLANNED | Traçabilité mutations (rôle, délégation, attribution) |
| RPC scoring serveur | PLANNED | Validation scoring côté serveur |
| Suppression `localStorage` résultats | PLANNED | Nettoyage frontend |

---

### P1.5 — Comptes & Import (Q4 2026)

| Tâche | Statut | Détails |
|-------|--------|---------|
| Edge Function `create_candidate_account` | PLANNED | `auth.admin.createUser()` + profil + `user_roles` + réponses |
| Edge Function `import_candidate_results` | PLANNED | JSON → `assessment_sessions` + `candidate_responses` |
| Migration import JSON → Supabase | PLANNED | Remplace `ntc_imported` localStorage |
| UI Super Admin : création compte candidat | PLANNED | Brancher sur Edge Function |

---

### P2.0 — Production Ready (Q1 2027)

| Domaine | Tâches |
|---------|--------|
| **Tests** | Unit (Vitest), E2E (Playwright), CI GitHub Actions |
| **Monitoring** | Logs Supabase, Vercel Analytics, alertes erreurs 5xx |
| **Performance** | Optimisation RPC (cache, index partiels), bundle size |
| **Sécurité** | CSP headers, rate limiting, audit `service_role`, penetration test |
| **Documentation** | Complète (API, admin guide, user guide) |
| **Accessibilité** | WCAG 2.1 AA |
| **i18n** | Structure i18n prête (fr/en) |

---

## Jalons clés (Milestones)

| Jalon | Date cible | Critères de succès |
|-------|------------|-------------------|
| **M1** : RBAC Base + Auth | 2026-09-14 | ✅ Fait — migrations 1-6 appliquées |
| **M2** : Super Admin UI + Pages/Features | 2026-09-15 | ✅ Fait — migrations 7-8 appliquées |
| **M3** | 2026-10-15 | RPC moteur autorité + UI Super Admin branchée |
| **M4** | 2026-11-30 | Résultats migrés vers Supabase + audit_log |
| **M5** | 2026-12-31 | Création comptes + Import JSON via Edge Functions |
| **M6** | 2027-03-31 | Version 1.0.0 — Production Ready |

---

## Risques & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance RPC récursif (`get_effective_authority`) | Moyenne | Élevé | Cache Redis côté RPC, limite profondeur 5, index FK |
| Validation `scope_value` polymorphe | Moyenne | Moyen | Validation forte dans RPC mutations, pas de FK polymorphe |
| Drift RLS vs Frontend | Faible | Moyen | Tests d'intégration réguliers, CI checks |
| Perte données migration localStorage → Supabase | Faible | Critique | Script one-shot + validation + backup avant migration |
| Fuite `service_role` | Faible | Critique | Audit régulier Edge Functions, rotation clés |

---

## Dépendances externes

| Dépendance | Version actuelle | Prochaine MAJ |
|------------|------------------|---------------|
| Supabase JS | 2.x | 3.x (quand dispo) |
| React | 19.2.8 | 20.x |
| Vite | 8.2.2 | 9.x |
| React Router | 7.18.3 | 8.x |
| recharts | 3.10.1 | 4.x |

---

## Budget & Ressources (estimatif)

| Phase | Effort estimé | Compétences requises |
|-------|---------------|---------------------|
| P1.3.4 RPC | 2-3 semaines | PostgreSQL avancé, PL/pgSQL, Supabase RPC |
| P1.4 Résultats | 3-4 semaines | PostgreSQL, migration données, audit |
| P1.5 Comptes/Import | 2-3 semaines | Edge Functions Deno, Supabase Admin API |
| P2.0 Prod Ready | 4-6 semaines | Tests, CI/CD, monitoring, sécurité |

---

*Dernière mise à jour : 2026-09-15*