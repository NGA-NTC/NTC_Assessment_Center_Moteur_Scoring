---
id: HIST-DEPLOYMENTS-001
title: Historique des déploiements
category: history
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - deployments
  - history
---

# Historique des déploiements

> **Note :** L'historique complet des déploiements Git/Vercel/Supabase n'est pas entièrement traçable dans le repo actuel. Seuls les événements vérifiables sont documentés.

---

## Déploiements Git / Vercel

| Date | Branche | Environnement | Commit | Notes |
|------|---------|---------------|--------|-------|
| UNKNOWN | `main` | Production | UNKNOWN | Déploiement initial |
| UNKNOWN | `develop` | Preview | UNKNOWN | Branche develop |

> **Note** : L'historique Git complet n'est pas disponible dans le contexte actuel. Seuls les migrations Supabase sont traçables.

---

## Déploiements Supabase

### Migrations appliquées

| Date | Migration | Description | Statut |
|------|-----------|-------------|--------|
| 2026-09-09 | `20260909213412_ntc_initial_schema.sql` | Schéma initial (vide) | ✅ |
| 2026-09-11 | `20260911_p1_2_profiles_rbac.sql` | Profils, RBAC base | ✅ |
| 2026-09-11 | `20260911210000_p1_2_1_security_fix.sql` | Security fix + super_admin | ✅ |
| 2026-09-12 | `20260912_p1_2_2_super_admin_cleanup.sql` | Nettoyage bootstrap | ✅ |
| 2026-09-13 | `20260913_p1_2_4_admin_rpc_edge.sql` | RPC admin + Edge Function | ✅ |
| 2026-09-14 | `20260914_p1_2_5_pages_features.sql` | Pages + Features | ✅ |
| 2026-09-15 | `20260915_p1_3_1_rbac_base_schema.sql` | Extension RBAC | ✅ |
| 2026-09-15 | `20260915165400_p1_3_2_delegation_schema.sql` | Schéma délégation | ✅ |

### Edge Functions déployées

| Function | Date déploiement | Version | Statut |
|----------|------------------|---------|--------|
| `admin-reset-password` | 2026-09-13 | v1 | ✅ Deployed |

---

## Déploiements Edge Functions

### `admin-reset-password`

| Déploiement | Date | Commit | Notes |
|-------------|------|--------|-------|
| Initial | 2026-09-13 | `20260913_p1_2_4_admin_rpc_edge.sql` | Création fonction + déploiement |

**Configuration :**
- Runtime : Deno
- Secrets : `SUPABASE_SERVICE_ROLE_KEY` (auto-injecté)
- CORS : `*` (développement)

---

## Vérifications post-déploiement

### Checklist post-déploiement standard

| Check | Commande | Résultat attendu |
|-------|----------|------------------|
| Migrations appliquées | `supabase migration list` | Toutes `remote` = `local` |
| Edge Functions | `supabase functions list` | `admin-reset-password` listée |
| Auth config | Dashboard Supabase | Site URL, Redirect URLs OK |
| RLS | Dashboard → Table editor | Policies actives |
| Edge Function test | `curl` POST | 200 OK + email envoyé |

---

## Rollback connu

| Date | Opération | Raison | Méthode |
|------|-----------|--------|---------|
| Aucune | — | — | — |

> Aucun rollback effectué à ce jour.

---

*Dernière mise à jour : 2026-09-15*