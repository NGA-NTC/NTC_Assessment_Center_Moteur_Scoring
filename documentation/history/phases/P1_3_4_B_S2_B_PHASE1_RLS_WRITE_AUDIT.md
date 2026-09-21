# P1.3.4-B-S2-B-PHASE1-RLS-WRITE-AUDIT

## AUDIT READ-ONLY : Écriture directe sur `public.role_permissions`

---

## A. Policies RLS actuelles sur `role_permissions`

| Policy | Command | Qual (USING) | With Check |
|---|---|---|---|
| `role_permissions_manage_admin` | `*` (INSERT, UPDATE, DELETE) | `has_role(auth.uid(), 'admin')` | `has_role(auth.uid(), 'admin')` |
| `role_permissions_manage_super_admin` | `*` (INSERT, UPDATE, DELETE) | `has_role(auth.uid(), 'super_admin')` | `has_role(auth.uid(), 'super_admin')` |
| `role_permissions_select_super_admin` | `r` (SELECT) | `has_role(auth.uid(), 'super_admin')` | — |

### Définition de `has_role()` (source : migration 20260911210000_p1_2_1_security_fix.sql)

```sql
create or replace function public.has_role(user_id uuid, role_text text)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = user_id and r.id = role_text
  );
$$;
```

**IMPORTANT** : `has_role()` ne vérifie **PAS** :
- `revoked_at`
- `expires_at`
- capabilities (USE/MANAGE/GRANT/DELEGATE)
- scope

---

## B. Qui peut INSERT / UPDATE / DELETE directement

| Acteur | Rôle assigné | `has_role()` retourne | Peut INSERT/UPDATE/DELETE ? |
|---|---|---|---|
| **super_admin** | `super_admin` | TRUE | ✅ OUI (policy `manage_super_admin`) |
| **admin** | `admin` | TRUE | ✅ OUI (policy `manage_admin`) |
| **candidate** | `candidate` | FALSE | ❌ NON |
| **authentifié sans rôle** | — | FALSE | ❌ NON |

**Condition suffisante** : Avoir le rôle `admin` OU `super_admin` assigné dans `user_roles` (même expiré/révoqué car `has_role()` ne vérifie pas).

---

## C. Possibilité de contourner GRANT / MANAGE / DELEGATE / scope / anti-escalation

### Analyse critique

| Protection RPC | Contournable par écriture directe ? |
|---|---|
| **GRANT sur `rbac.role_permissions`** | ✅ **OUI** — policy ne vérifie que le rôle, pas la capability |
| **GRANT sur permission cible** | ✅ **OUI** — aucune vérification |
| **MANAGE / DELEGATE** | ✅ **OUI** — aucune vérification |
| **Scope (global/role/user)** | ✅ **OUI** — aucune vérification de scope |
| **Anti-auto-élévation (`has_role_effective`)** | ✅ **OUI** — policy ne l'appelle pas |
| **Anti-auto-révocation** | ✅ **OUI** — policy ne l'appelle pas |
| **Expiration / révocation du rôle** | ✅ **OUI** — `has_role()` ignore `revoked_at` et `expires_at` |

### Preuve : Scenario de contournement concret

**Admin sans GRANT sur `rbac.role_permissions`** :
1. A le rôle `admin` assigné dans `user_roles`
2. N'a **PAS** `can_grant=true` sur `rbac.role_permissions` dans `role_permissions`
3. Appelle directement : `INSERT INTO role_permissions (role_id, permission_id, can_grant) VALUES ('target_role', 'users.change_role', true);`
4. **RÉUSSIT** — policy `role_permissions_manage_admin` autorise car `has_role(auth.uid(), 'admin')` = TRUE
5. **RPC `grant_role_permission()` aurait REFUSÉ** : `PERMISSION_INSUFFISANTE: GRANT sur rbac.role_permissions requis`

**Admin avec rôle expiré/révoqué** :
1. Rôle `admin` avec `expires_at < now()` OU `revoked_at IS NOT NULL`
2. `has_role()` retourne quand même TRUE (ne vérifie pas expiration/révocation)
3. Peut écrire directement dans `role_permissions`

---

## D. Appels directs trouvés dans le code

### Edge Functions (Deno/TypeScript)
| Fichier | Appel direct à `role_permissions` ? |
|---|---|
| `supabase/functions/admin-reset-password/index.ts` | ❌ Non — utilise RPC `has_permission` + service_role pour auth admin |

### Frontend (React/TypeScript)
| Recherche | Résultat |
|---|---|
| `grep -r "role_permissions"` sur `*.ts,*.tsx` | **Aucun fichier** trouvé (seul `supabase/functions/...` existe) |
| `.from('role_permissions').insert/update/delete` | **Introuvable** |

### Migrations SQL
| Migration | Écriture directe sur `role_permissions` ? |
|---|---|
| Initial data (20260911, 20260911210000) | ✅ Oui — `INSERT INTO role_permissions` pour bootstrap |
| P1.3.4-B-S2-B Phase 1 & correction | ✅ Oui — `INSERT/UPDATE` dans RPC `SECURITY DEFINER` (bypass RLS intentionnel) |

---

## E. Risque de contournement — Analyse détaillée

### 1. Modèle validé vs RLS actuel

| Règle modèle | RLS actuel |
|---|---|
| `MANAGE ≠ GRANT` | ❌ Violée — admin avec MANAGE seulement peut écrire |
| `GRANT = attribuer à autrui` | ❌ Violée — admin sans GRANT peut attribuer |
| `DELEGATE ≠ GRANT` | ❌ Violée — admin sans DELEGATE peut créer DELEGATE |
| `aucune auto-élévation` | ❌ Violée — admin peut s'accorder GRANT/DELEGATE |
| `scope respecté` | ❌ Violée — admin global peut écrire sur scope `role:X` |
| `expiration/révocation respectée` | ❌ Violée — rôle expiré/révoqué permet écriture |
| `RPC sécurisées non contournables` | ❌ Violée — écriture directe bypass complet |

### 2. Vecteurs d'attaque

| Attaque | Prérequis | Impact |
|---|---|---|
| **Escalade de privilèges** | Rôle `admin` assigné | S'accorder GRANT/DELEGATE sur `rbac.*`, prendre contrôle total RBAC |
| **Élargissement de scope** | Rôle `admin` (scope global) | Écrire sur permissions scope `role:X` / `user:U` sans y avoir droit |
| **Rôle zombie** | Rôle `admin` expiré/révoqué | Continuer à gérer RBAC après révocation |
| **Contournement audit** | Accès direct SQL | Modifications non tracées par RPC (pas d'actor, pas de scope loggé) |

---

## F. Verdict

### ❌ NO-GO — BYPASS POSSIBLE

**Le contournement est PROUVÉ et CRITIQUE.**

| Critère | Statut |
|---|---|
| Admin sans GRANT peut écrire | ✅ **CONFIRMÉ** |
| Admin sans GRANT sur cible peut écrire | ✅ **CONFIRME** |
| Scope ignoré | ✅ **CONFIRMÉ** |
| Anti-escalade ignorée | ✅ **CONFIRMÉ** |
| Expiration/révocation ignorée | ✅ **CONFIRMÉ** |
| Super_admin bypass | ✅ **CONFIRMÉ** (mais par design bootstrap) |

---

## Classification des constats

| # | Constat | Méthode | Gravité |
|---|---|---|---|
| 1 | Policies INSERT/UPDATE/DELETE utilisent `has_role()` sans vérification capability | **VERIFIED BY INSPECTION** | 🔴 CRITIQUE |
| 2 | `has_role()` ignore `revoked_at` / `expires_at` | **VERIFIED BY INSPECTION** | 🔴 CRITIQUE |
| 3 | Admin sans GRANT peut contourner RPC | **VERIFIED BY INSPECTION** | 🔴 CRITIQUE |
| 4 | Scope non vérifié | **VERIFIED BY INSPECTION** | 🔴 CRITIQUE |
| 5 | Expiration/révocation ignorée | **VERIFIED BY INSPECTION** | 🔴 CRITIQUE |
| 6 | Aucun appel direct frontend trouvé | **VERIFIED BY INSPECTION** | 🟢 OK (mais risque futur) |
| 7 | Edge Function utilise RPC sécurisé | **VERIFIED BY INSPECTION** | 🟢 OK |
| 8 | RPC `SECURITY DEFINER` bypassent RLS intentionnellement | **VERIFIED BY INSPECTION** | 🟢 OK (design) |

---

## Recommandation immédiate

**NE PAS PASSER EN PHASE 2** tant que les policies RLS `role_permissions` ne sont pas corrigées pour exiger :

Option A (stricte) : `has_effective_capability(auth.uid(), 'GRANT', 'rbac.role_permissions', ...)` dans policy
Option B (moyenne) : Créer policy qui appelle RPC ou fonction helper validant GRANT + scope

Et corriger `has_role()` pour respecter expiration/révocation, ou remplacer par `has_role_effective()` dans les policies.

---

**Aucun test d'intégration exécuté** — uniquement inspection SQL et code.
**Aucune modification effectuée.** En attente de décision.