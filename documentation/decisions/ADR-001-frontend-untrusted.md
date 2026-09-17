---
id: ADR-001
title: Frontend non fiable — Sécurité côté Supabase
status: accepted
date: 2026-09-11
category: decisions
tags:
  - security
  - frontend
  - supabase
---

# ADR-001 : Frontend non fiable — Sécurité côté Supabase

## Statut
**Accepted** — 2026-09-11

## Contexte

L'application NTC est une SPA 100% côté client (React + Vite). Initialement, certaines vérifications d'autorisation étaient effectuées uniquement côté frontend (ex: `hasRole('admin')` pour afficher/masquer des boutons).

**Problèmes identifiés :**
1. Le code frontend est visible et modifiable par l'utilisateur (DevTools, bundle JS).
2. Les guards de routing (`ProtectedRoute`, `SuperAdminRoute`) ne sont que de l'UX — un utilisateur malveillant peut les contourner en manipulant le state React ou en appelant directement les APIs Supabase.
3. Les identifiants admin étaient initialement prévus dans le bundle frontend (`.env` → bundle JS).
4. Aucune validation serveur des mutations critiques (création user, attribution rôle, reset MDP).

## Décision

**Toute la sécurité réelle doit résider côté Supabase (backend). Le frontend n'est qu'une interface UX.**

### Mesures implémentées (P1.2.1 Security Fix)

| Mesure | Implémentation |
|--------|----------------|
| **RLS sur toutes tables** | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policies restrictives |
| **RPC `SECURITY DEFINER`** | Toutes mutations sensibles via RPC `SECURITY DEFINER` + `SET search_path = public` |
| **Fonctions `has_role`/`has_permission`** | `SECURITY DEFINER` + `STABLE` + `SET search_path = public` pour RLS/RPC |
| **`REVOKE EXECUTE`** | Sur fonctions sensibles (`bootstrap_super_admin`, `promote_to_admin`, `handle_new_user`, `set_updated_at`) pour `anon, authenticated, public` |
| **Edge Functions** | Opérations `service_role` (création user, reset MDP) uniquement dans Edge Functions Deno |
| **Frontend = UX only** | `hasRole()`/`hasPermission()` → affichage conditionnel seulement, pas de protection |

## Alternatives considérées

| Alternative | Évaluation |
|-------------|------------|
| Vérifs autorisation côté frontend seulement | **Rejeté** — contournable trivialement |
| Backend dédié (Node/Express) | **Rejeté** — complexité + coût, Supabase suffit |
| JWT custom avec claims rôles | **Rejeté** — Supabase Auth gère déjà JWT, RLS plus robuste |
| Supabase Realtime pour sync permissions | **Rejeté** — overkill, RLS + RPC suffisent |

## Conséquences

### Positives
- ✅ Sécurité centralisée en base (source de vérité unique)
- ✅ Frontend allégé (pas de logique auth complexe)
- ✅ RLS protège même contre requêtes directes API/PostgREST
- ✅ Edge Functions isolent `service_role` (jamais exposé au frontend)
- ✅ Audit trail possible via triggers DB + future `audit_log`

### Négatives / Risques
- ⚠️ Complexité RLS + RPC supérieure (courbe apprentissage)
- ⚠️ Debug plus difficile (logs Supabase vs console navigateur)
- ⚠️ Latence RPC vs appel direct (mitigé par `SECURITY DEFINER` + index)
- ⚠️ Frontend peut afficher des éléments non autorisés (UX seulement) — accepter, sécurité réelle en backend

### À surveiller
- 🔍 Performance RPC sous charge (monitoring `pg_stat_statements`)
- 🔍 Fuites potentielles `service_role` (audit régulier Edge Functions)
- 🔍 Drift entre RLS et logique frontend (tests d'intégration réguliers)

## Contexte technique

### Migrations associées
- `20260911210000_p1_2_1_security_fix.sql` — Security fix complet
- `20260911210000_p1_2_1_security_fix.sql` — Ajout `super_admin` + RPC bootstrap/promote

### Fichiers clés
- `supabase/migrations/20260911210000_p1_2_1_security_fix.sql`
- `supabase/functions/admin-reset-password/index.ts`
- `src/context/UserAuthContext.jsx` (frontend UX only)
- `src/routes/ProtectedRoute.jsx`, `SuperAdminRoute.jsx` (guards UX only)

### RPC sécurisées
| RPC | Sécurité | Usage |
|-----|----------|-------|
| `bootstrap_super_admin` | `SECURITY DEFINER` + `service_role` only | Bootstrap unique |
| `promote_to_admin` | `SECURITY DEFINER` + check super_admin + perm | Promotion admin |
| `admin_reset_user_password` | `SECURITY DEFINER` + check perm | Reset MDP via Edge Function |
| `has_role` / `has_permission` | `SECURITY DEFINER` + `STABLE` | RLS + RPC checks |

---

*Décision validée le 2026-09-11 — Appliquée via migration `20260911210000_p1_2_1_security_fix.sql`*