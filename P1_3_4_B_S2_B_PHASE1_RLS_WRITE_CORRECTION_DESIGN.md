# P1.3.4-B-S2-B-PHASE1-RLS-WRITE-CORRECTION-DESIGN

## A. PROBLÈME ACTUEL

### Bypass critique prouvé
Les policies RLS `role_permissions_manage_admin` et `role_permissions_manage_super_admin` permettent à tout utilisateur ayant le rôle `admin` ou `super_admin` assigné (même expiré/révoqué) d'effectuer **INSERT/UPDATE/DELETE direct** sur `public.role_permissions` sans aucune vérification de :
- GRANT sur `rbac.role_permissions`
- GRANT sur permission cible
- Scope (global/role/user)
- Anti-auto-élévation / anti-auto-révocation
- Expiration / révocation du rôle

### Surface d'attaque
| Attaque | Prérequis | Impact |
|---|---|---|
| Escalade privilèges | Rôle `admin` assigné | S'accorder GRANT/DELEGATE sur `rbac.*`, contrôle total RBAC |
| Élargissement scope | Rôle `admin` (scope global) | Écrire sur scope `role:X` / `user:U` sans droit |
| Rôle zombie | Rôle `admin` expiré/révoqué | Continuer à gérer RBAC après révocation |
| Contournement audit | Accès direct SQL | Modifications non tracées par RPC |

---

## B. DÉPENDANCES EXISTANTES

### 1. Policies RLS utilisant `has_role()`

| Table | Policy | Command | Qual / With Check |
|---|---|---|---|
| `role_permissions` | `role_permissions_manage_admin` | `*` | `has_role(auth.uid(), 'admin')` |
| `role_permissions` | `role_permissions_manage_super_admin` | `*` | `has_role(auth.uid(), 'super_admin')` |
| `role_permissions` | `role_permissions_select_super_admin` | `r` | `has_role(auth.uid(), 'super_admin')` |
| `profiles` | `profiles_select_admin` | `r` | `has_role(auth.uid(), 'admin')` |
| `profiles` | `profiles_update_admin` | `u` | `has_role(auth.uid(), 'admin')` |
| `profiles` | `profiles_insert_admin` | `a` | `has_role(auth.uid(), 'admin')` |
| `profiles` | `profiles_select_super_admin` | `r` | `has_role(auth.uid(), 'super_admin')` |
| `profiles` | `profiles_update_super_admin` | `u` | `has_role(auth.uid(), 'super_admin')` |
| `profiles` | `profiles_insert_super_admin` | `a` | `has_role(auth.uid(), 'super_admin')` |
| `profiles` | `profiles_delete_super_admin` | `d` | `has_role(auth.uid(), 'super_admin')` |
| `roles` | `roles_manage_admin` | `*` | `has_role(auth.uid(), 'admin')` |
| `permissions` | `permissions_manage_admin` | `*` | `has_role(auth.uid(), 'admin')` |
| `role_permissions` (ancienne) | `role_permissions_manage_admin` | `*` | `has_role(auth.uid(), 'admin')` |
| `user_roles` | `user_roles_select_admin` | `r` | `has_role(auth.uid(), 'admin')` |
| `user_roles` | `user_roles_insert_admin` | `a` | `has_role(auth.uid(), 'admin') AND has_permission(auth.uid(), 'users.change_role')` |
| `user_roles` | `user_roles_delete_admin` | `d` | `has_role(auth.uid(), 'admin') AND has_permission(auth.uid(), 'users.change_role')` |
| `user_roles` | `user_roles_select_super_admin` | `r` | `has_role(auth.uid(), 'super_admin')` |
| `user_roles` | `user_roles_insert_super_admin` | `a` | `has_role(auth.uid(), 'super_admin') AND has_permission(auth.uid(), 'users.change_role')` |
| `user_roles` | `user_roles_delete_super_admin` | `d` | `has_role(auth.uid(), 'super_admin') AND has_permission(auth.uid(), 'users.change_role')` |
| `role_delegations` | `role_delegations_select_super_admin` | `r` | `has_role(auth.uid(), 'super_admin')` |
| `role_delegations` | `role_delegations_manage_super_admin` | `*` | `has_role(auth.uid(), 'super_admin')` |
| `user_delegations` | `user_delegations_select_super_admin` | `r` | `has_role(auth.uid(), 'super_admin')` |
| `user_delegations` | `user_delegations_manage_super_admin` | `*` | `has_role(auth.uid(), 'super_admin')` |
| `role_assignability` | `role_assignability_select_super_admin` | `r` | `has_role(auth.uid(), 'super_admin')` |
| `role_assignability` | `role_assignability_manage_super_admin` | `*` | `has_role(auth.uid(), 'super_admin')` |
| `pages` | `pages_manage_admin` | `*` | `has_role(auth.uid(), 'admin')` |
| `features` | `features_manage_admin` | `*` | `has_role(auth.uid(), 'admin')` |
| `page_features` | `page_features_manage_admin` | `*` | `has_role(auth.uid(), 'admin')` |

### 2. Fonction `has_role()` — Définition

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

**Ne vérifie PAS** : `revoked_at`, `expires_at`, capabilities, scope.

### 3. RPC utilisant `has_role()` internement

| RPC | Utilisation de `has_role()` |
|---|---|
| `bootstrap_super_admin()` | Ligne 23 : `select public.has_role(auth.uid(), 'super_admin')` pour bypass bootstrap |
| `promote_to_admin()` | Ligne 238 : `public.has_role(auth.uid(), 'super_admin')` pour autorisation |
| `get_effective_authority()` | Ligne 242 : `public.has_role(auth.uid(), 'super_admin')` pour lecture tierce |

### 4. Edge Functions

| Fichier | Appel direct `role_permissions` |
|---|---|
| `supabase/functions/admin-reset-password/index.ts` | ❌ Non — utilise RPC `has_permission` + service_role |

### 5. Frontend (React/TypeScript)

| Recherche | Résultat |
|---|---|
| `role_permissions` dans `*.ts,*.tsx` | **Aucun fichier** (projet minimal, pas de frontend RBAC complet) |

### 6. Migrations — Écritures directes

| Migration | Opération sur `role_permissions` |
|---|---|
| 20260911_p1_2_profiles_rbac.sql | `INSERT` bootstrap permissions |
| 20260911210000_p1_2_1_security_fix.sql | `INSERT` super_admin permissions |
| 20260915_p1_3_1_rbac_base_schema.sql | `UPDATE` migration capabilities |
| 20260917140000_phase1 | `INSERT` permissions `rbac.*` + caps super_admin |
| 20260917200000_correction_v2 | `INSERT/UPDATE` dans RPC `SECURITY DEFINER` |

---

## C. RPC SECURITY DEFINER — État actuel

### `grant_role_permission` / `revoke_role_permission` / `get_role_permission`

| Caractéristique | Statut |
|---|---|
| `SECURITY DEFINER` | ✅ Oui |
| `SET search_path = public` | ✅ Oui |
| `EXECUTE` à `authenticated` | ✅ Oui |
| `REVOKE EXECUTE` de `anon` | ✅ Oui |
| `auth.uid()` comme acteur | ✅ Oui |
| Bypass `has_role('super_admin')` | ❌ Supprimé (correction v2) |
| Vérification `has_effective_capability()` | ✅ Oui |
| Vérification `scope_includes()` via S1 | ✅ Oui |
| Anti-escalade capability | ✅ Oui |
| Anti-auto-élévation via `has_role_effective()` | ✅ Oui |

### Comportement RLS avec SECURITY DEFINER

> **Règle PostgreSQL** : Une fonction `SECURITY DEFINER` s'exécute avec les privilèges de son **propriétaire** (ici `postgres` superuser), ce qui **bypasse complètement RLS** pour les opérations internes à la fonction.

C'est **par design** : les RPC font leurs propres vérifications d'autorisation, puis écrivent directement.

---

## D. OPTIONS ARCHITECTURALES

### OPTION A — Policy RLS vérifiant GRANT/scope via fonction helper

```sql
-- Policy exemple
CREATE POLICY "role_permissions_write_via_grant"
ON public.role_permissions FOR ALL
TO authenticated
USING (public.has_effective_capability(auth.uid(), 'GRANT', 'rbac.role_permissions', ...))
WITH CHECK (public.has_effective_capability(auth.uid(), 'GRANT', 'rbac.role_permissions', ...));
```

#### Analyse récursion RLS

| Étape | Risque |
|---|---|
| 1. User fait `INSERT INTO role_permissions...` | RLS évalue `USING` |
| 2. Appelle `has_effective_capability(uid, 'GRANT', 'rbac.role_permissions', ...)` | Fonction `SECURITY DEFINER` (bypass RLS) |
| 3. `has_effective_capability` lit `role_permissions` pour vérifier caps | **Lecture** — RLS `SELECT` s'applique |
| 4. RLS `SELECT` = `role_permissions_select_super_admin` (super_admin seulement) | **BLOCAGE** : user non-super_admin ne peut pas lire `role_permissions` pour vérifier s'il a GRANT |

**❌ RECURSION / BLOCAGE GARANTI**

La policy `SELECT` restreint la lecture à `super_admin` seulement. Une policy `INSERT/UPDATE/DELETE` qui appelle une fonction lisant `role_permissions` échouera pour tout non-super_admin.

#### Contournement possible

Créer une **fonction helper `SECURITY DEFINER` avec `search_path`** qui lit `role_permissions` **en ignorant RLS** (car propriétaire postgres) :

```sql
create or replace function public.check_rbac_grant_for_write(
    p_user_id uuid,
    p_target_role_id text,
    p_permission_id text,
    p_scope_type text,
    p_scope_value text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Cette fonction s'exécute en tant que postgres (owner), bypass RLS
    return public.has_effective_capability(p_user_id, 'GRANT', 'rbac.role_permissions', p_scope_type, p_scope_value)
           and public.has_effective_capability(p_user_id, 'GRANT', p_permission_id, p_scope_type, p_scope_value)
           and public.scope_includes(...); -- vérifications scope
end;
$$;
```

Puis policy :
```sql
CREATE POLICY "role_permissions_write_checked"
ON public.role_permissions FOR ALL
TO authenticated
USING (public.check_rbac_grant_for_write(auth.uid(), NEW.role_id, NEW.permission_id, ...))
WITH CHECK (public.check_rbac_grant_for_write(auth.uid(), NEW.role_id, NEW.permission_id, ...));
```

**Complexité** : Élevée. Nécessite passer `NEW.*` à la fonction, gérer INSERT/UPDATE/DELETE différemment.

---

### OPTION B — Supprimer toutes écritures directes `authenticated`, imposer RPC

```sql
-- Supprimer policies INSERT/UPDATE/DELETE pour authenticated
DROP POLICY "role_permissions_manage_admin" ON public.role_permissions;
DROP POLICY "role_permissions_manage_super_admin" ON public.role_permissions;

-- Conserver seulement SELECT pour super_admin
-- (ou supprimer aussi si get_role_permission suffit)
```

#### Architecture

```
authenticated user
    │
    ├── SELECT direct → super_admin seulement (ou via get_role_permission)
    │
    └── INSERT/UPDATE/DELETE → IMPOSSIBLE direct
         │
         ▼
    RPC SECURITY DEFINER (grant_role_permission / revoke_role_permission)
         │
         ▼
    role_permissions (bypass RLS car owner=postgres)
```

#### Compatibilité

| Composant | Impact |
|---|---|
| **RPC `grant_role_permission` / `revoke_role_permission`** | ✅ Fonctionnent — `SECURITY DEFINER` owner=postgres bypass RLS |
| **Migrations (bootstrap)** | ✅ Fonctionnent — s'exécutent en tant que `postgres` superuser, pas `authenticated` |
| **`bootstrap_super_admin()`** | ✅ Fonctionne — `SECURITY DEFINER` owner=postgres |
| **`promote_to_admin()`** | ⚠️ Vérifie `has_role('super_admin')` — lit `user_roles` (RLS `SELECT` super_admin/admin OK) |
| **`get_effective_authority()`** | ⚠️ Vérifie `has_role('super_admin')` pour lecture tierce — même |
| **Edge Functions** | ✅ Utilisent RPC, pas écriture directe |
| **Frontend** | ✅ Aucun appel direct trouvé |

#### Avantages
- **Sécurité maximale** : Impossible de contourner RPC
- **Architecture claire** : Mutation = RPC seulement
- **Pas de récursion RLS** : Pas de policy complexe
- **Audit naturel** : Toute mutation passe par RPC (actor, scope, caps loggués)

#### Inconvénients
- **Breaking change** : Tout code futur faisant `INSERT/UPDATE/DELETE` direct cassera
- **Admin perd écriture directe** : Doit passer par RPC (intentionnel)

---

### OPTION C — Hybride : Pas d'écriture directe, root/bootstrap séparé

Identique à Option B mais avec mécanisme explicite pour bootstrap/maintenance :

```sql
-- 1. Supprimer policies INSERT/UPDATE/DELETE authenticated
-- 2. Conserver SELECT super_admin (pour debug/admin UI)
-- 3. Créer fonction SECURITY DEFINER pour bootstrap/maintenance si besoin
create or replace function public.bootstrap_role_permission_direct(...)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Vérification explicite super_admin via capability (pas nom de rôle)
    if not public.has_effective_capability(auth.uid(), 'DELEGATE', 'rbac.role_permissions', 'global', null) then
        raise exception 'Accès refusé';
    end if;
    -- Écriture directe
    insert into role_permissions ...;
end;
$$;
```

**Différence avec Option B** : Mécanisme d'urgence documenté et audité, plutôt que politique RLS ouverte.

---

## E. ANALYSE RÉCURSION RLS — DÉTAIL

### Le cycle potentiel

```
Policy INSERT/UPDATE/DELETE sur role_permissions
    ↓ USING/WITH CHECK
Fonction has_effective_capability(uid, 'GRANT', 'rbac.role_permissions', ...)
    ↓ (SECURITY DEFINER, bypass RLS pour exécution)
SELECT sur role_permissions (pour lire caps)
    ↓ RLS SELECT
Policy role_permissions_select_super_admin
    ↓ USING has_role(auth.uid(), 'super_admin')
    ↓ BLOCAGE si user ≠ super_admin
```

### Solution technique

Une fonction `SECURITY DEFINER` appelée depuis une policy RLS **s'exécute avec les privilèges de son propriétaire (postgres)**, donc **bypass RLS** pour ses requêtes internes.

**MAIS** : La policy `SELECT` sur `role_permissions` s'applique **avant** l'appel de la fonction dans `USING`/`WITH CHECK` ? Non.

**Ordre d'évaluation PostgreSQL** :
1. Policy `USING` évaluée pour la ligne existante (UPDATE/DELETE) ou nouvelle (INSERT)
2. Expression `USING` peut appeler des fonctions
3. Fonction `SECURITY DEFINER` s'exécute → **bypass RLS** pour ses propres requêtes
4. Résultat fonction → TRUE/FALSE → Policy autorise/refuse

**Donc** : Une fonction helper `SECURITY DEFINER` **peut lire `role_permissions`** même si la policy `SELECT` restreint l'accès, car la fonction s'exécute en tant que `postgres`.

**✅ PAS DE RÉCURSION SI** : La fonction helper est `SECURITY DEFINER` avec `SET search_path = public`.

---

## F. RECOMMANDATION ARCHITECTURALE

### Recommandation : **OPTION B** (Supprimer écritures directes, imposer RPC)

#### Justification

| Critère | Option A (Policy helper) | Option B (RPC only) | Option C (Hybride) |
|---|---|---|---|
| **Sécurité** | Dépend de l'implémentation helper | **Maximale** — aucune écriture directe | Maximale + mécanisme d'urgence |
| **Risque bypass** | Faible si helper correct | **Nul** — architecture l'empêche | Nul |
| **Complexité** | Élevée (helper + policy + tests) | **Faible** — suppression policies | Moyenne |
| **Récursion RLS** | Risque si mal fait | **Aucun** — pas de policy écriture | Aucun |
| **Compatibilité migrations** | ✅ | ✅ | ✅ |
| **Compatibilité RPC existants** | ✅ | ✅ | ✅ |
| **Impact frontend** | Aucun (pas d'appel direct) | **Aucun** (pas d'appel direct) | Aucun |
| **Audit** | Partiel (policy + helper) | **Complet** (toute mutation = RPC) | Complet |
| **Maintenance** | Fonction helper à maintenir | **Simplement** — pas de policy écriture | Simplement |

### Pourquoi pas Option A ?

La complexité d'une policy qui appelle une fonction helper `SECURITY DEFINER` avec passage de `NEW.*` est source de bugs. Le modèle PostgreSQL RLS + `SECURITY DEFINER` functions est subtil et propice aux erreurs.

### Pourquoi pas Option C ?

Le mécanisme "root/bootstrap séparé" ajoute de la surface d'attaque. Si `super_admin` a besoin d'écrire directement, il utilise la RPC `grant_role_permission` qui a déjà toutes les vérifications. Pas besoin de porte dérobée.

---

## G. MIGRATION NÉCESSAIRE ESTIMÉE

```sql
-- 1. Supprimer policies INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "role_permissions_manage_admin" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_manage_super_admin" ON public.role_permissions;

-- 2. (Optionnel) Supprimer SELECT si get_role_permission suffit
-- DROP POLICY IF EXISTS "role_permissions_select_super_admin" ON public.role_permissions;
-- OU conserver pour debug/admin UI

-- 3. Vérifier que RPC existants fonctionnent (SECURITY DEFINER owner=postgres)
-- Aucune modification RPC nécessaire

-- 4. Test : tenter INSERT direct en tant qu'admin → doit échouer
-- Test : appeler grant_role_permission() en tant qu'admin avec GRANT → doit réussir
```

**Fichiers à créer** : 1 migration corrective (`20260917xxxx_p1_3_4_b_s2_b_phase1_rls_fix.sql`)

**Lignes estimées** : ~30 lignes SQL

---

## H. IMPACT

| Composant | Impact |
|---|---|
| **Migrations futures** | ✅ Aucuns — s'exécutent en `postgres` superuser |
| **RPC Phase 1** | ✅ Aucun — `SECURITY DEFINER` bypass RLS |
| **RPC Phase 2+ (futurs)** | ✅ Même architecture |
| **Edge Functions** | ✅ Aucuns — utilisent RPC |
| **Frontend actuel** | ✅ Aucun — pas d'appel direct |
| **Frontend futur** | ⚠️ Doit utiliser RPC, pas écriture directe (à documenter) |
| **Super Admin bootstrap** | ✅ `bootstrap_super_admin()` fonctionne (SECURITY DEFINER) |
| **Admin UI (futur)** | ⚠️ Doit appeler RPC pour mutations RBAC |

---

## I. STRATÉGIE DE VALIDATION

| Test | Méthode | Critère de succès |
|---|---|---|
| **T1** Admin sans GRANT tente INSERT direct | SQL direct `psql` | `ERROR: permission denied` |
| **T2** Admin avec GRANT appelle `grant_role_permission()` | RPC call | Succès, ligne insérée |
| **T3** Admin sans GRANT appelle `grant_role_permission()` | RPC call | `PERMISSION_INSUFFISANTE` |
| **T4** Super Admin INSERT direct | SQL direct | Selon policy SELECT conservée ou non |
| **T5** `bootstrap_super_admin()` | SQL direct | Succès (bypass RLS via SECURITY DEFINER) |
| **T6** `promote_to_admin()` par Super Admin | RPC call | Succès |
| **T7** `get_effective_authority()` par Super Admin | RPC call | Succès (lit `user_roles` via RLS SELECT) |
| **T8** Migration clean apply | `supabase db reset --local` | Toutes migrations passent |

---

## J. RISQUES RÉSIDUELS

| Risque | Probabilité | Atténuation |
|---|---|---|
| Code futur fait `INSERT` direct et casse | Moyenne | Documentation + revue de code + tests CI |
| `promote_to_admin` / `get_effective_authority` cassés par RLS `user_roles` | Faible | `has_role()` utilisé dans ces RPC lit `user_roles` — RLS `SELECT` admin/super_admin autorise |
| Migration `bootstrap` cassée | Très faible | S'exécute en `postgres` superuser, pas `authenticated` |
| Récursion RLS imprévue | Très faible | Aucune policy INSERT/UPDATE/DELETE = pas d'appel fonction dans policy |

---

## VERDICT

**READY_FOR_CORRECTION**

L'Option B est la plus sûre, la plus simple et la plus alignée avec le principe : **"Les mutations RBAC passent par des RPC sécurisées, jamais par écriture directe."**

Aucun obstacle technique bloquant identifié. La correction est une simple suppression de 2 policies RLS.

---

**En attente de validation pour implémentation (nouvelle migration corrective RLS).**