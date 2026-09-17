---
id: ADR-003
title: Modèle de délégation hiérarchique + individuelle
status: accepted
date: 2026-09-15
category: decisions
tags:
  - delegation
  - rbac
  - authorization
---

# ADR-003 : Modèle de délégation hiérarchique + individuelle

## Statut
**Accepted** — 2026-09-15

## Contexte

Le modèle RBAC de base (P1.2) est binaire : un rôle a une permission ou pas. Besoin d'un système de **délégation explicite** permettant :
- Super Admin de déléguer des pouvoirs à Admin
- Admin de déléguer à Encadreur
- Délégation individuelle (exception) pour cas particuliers
- Contrôle de portée (scope) : global, par rôle, par user, soi-même
- Anti-escalade : on ne délègue que ce qu'on a, dans son scope

## Décision

Modèle de délégation en **3 couches** avec tables dédiées (P1.3.2) :

### 1. `role_delegations` — Délégation standard (rôle → rôle)

| Colonne | Rôle |
|---------|------|
| `delegator_role_id` | Rôle qui délègue (source) |
| `target_role_id` | Rôle bénéficiaire (cible) |
| `permission_id` | Permission déléguée |
| `delegation_type` | `use` \| `manage` \| `grant` (**PAS `delegate`**) |
| `scope_type` + `scope_value` | Portée : `global` / `role:X` / `user:uuid` / `self` |
| `created_by` / `created_at` / `expires_at` / `revoked_at` / `revoked_by` | Traçabilité complète |

> `delegation_type` = `use` | `manage` | `grant` — **`delegate` N'EST PAS un type de délégation**. `DELEGATE` est une capacité portée par `role_permissions.can_delegate`.

### 2. `user_delegations` — Délégation individuelle (exception)

| Colonne | Rôle |
|---------|------|
| `granter_user_id` / `grantee_user_id` | User source / bénéficiaire |
| `permission_id` + `delegation_type` + `scope_type` + `scope_value` | Même modèle que rôle |
| `reason` | Justification obligatoire (exception) |
| `expires_at` / `revoked_at` / `revoked_by` | Cycle de vie |

> **Règle critique** : Une délégation individuelle ne donne **PAS** le droit de redéléguer. Le bénéficiaire ne reçoit **PAS** `DELEGATE` via cette table.

### 3. `role_assignability` — Quels rôles un rôle peut attribuer

| Colonne | Rôle |
|---------|------|
| `assigner_role_id` | Rôle qui peut attribuer |
| `assignable_role_id` | Rôle attribuable |
| `created_by` / `created_at` | Traçabilité |

> **PK composite** : `(assigner_role_id, assignable_role_id)` — évite doublons.

> **Règle** : `role_assignability` = configuration déclarative **seulement**. Ne donne **PAS** de droit effectif. L'attribution réelle nécessite :
> 1. `role_assignability` contient `(current_role, target_role)`
> 2. Capacité effective `ASSIGN_ROLE` + scope
> 3. Anti-escalade (niveau hiérarchique, scope)

---

## Règles fondamentales

### 1. Délégation ≠ Autorisation automatique de redélégation
- `DELEGATE` = capacité explicite sur `role_permissions.can_delegate`
- Une délégation `grant` ne donne **pas** `can_delegate` au bénéficiaire
- Pour redéléguer : il faut `can_delegate = true` effectif sur la permission + scope

### 2. Scope jamais élargi
- `scope_includes(scope_possédé, scope_demandé)` doit être TRUE
- `global` ⊃ `role:R` ⊃ `user:U` (si U a rôle R) ⊃ `self`

### 3. Anti-escalade structurelle
| Règle | Implémentation |
|-------|----------------|
| Auto-délégation | CHECK `delegator != target` / `granter != grantee` |
| Permission non possédée | RPC vérifie `has_effective_capability(DELEGATE)` avant INSERT |
| Niveau supérieur | Vérifie `can_delegate` effectif sur perm+scope |
| Élargissement scope | `scope_includes(scope_possédé, scope_demandé)` = TRUE |
| Redélégation non autorisée | Bénéficiaire délégation n'a PAS `can_delegate` via cette délégation |

### 4. Cycle de vie
| Événement | Traitement |
|---------|------------|
| Création | INSERT + vérifs RPC (anti-escalade, scope, autorité) |
| Lecture | `expires_at > now()` + `revoked_at IS NULL` + `scope_includes` |
| Révocation | UPDATE `revoked_at` + `revoked_by` (pas de DELETE) |
| Expiration | Ignorée si `expires_at <= now()` |

---

## Alternatives considérées

| Alternative | Évaluation |
|-------------|------------|
| Délégation implicite par hiérarchie (`parent_id`) | **Rejeté** — `parent_id` = info structurelle, pas autorité |
| `DELEGATE` comme `delegation_type` | **Rejeté** — confusion capacité/type, `DELEGATE` = capacité |
| Délégation user→user = standard | **Rejeté** — doit rester exception (`user_delegations` séparée) |
| Scope `organization` / `department` | **Rejeté** — YAGNI, `role` + `user` + `self` suffisent |

## Conséquences

### Positives
- ✅ Délégation explicite, traçable, contrôlée
- ✅ Scopes granulaires (global → self)
- ✅ Anti-escalade multi-niveaux (SQL CHECK + RPC + RLS)
- ✅ Exception individuelle sans casser modèle rôle
- ✅ Traçabilité complète (created_by, revoked_by, expires_at, reason)

### Négatives
- ⚠️ Complexité RPC moteur autorité effective (P1.3.4)
- ⚠️ Validation `scope_value` polymorphe (FK polymorphe impossible)
- ⚠️ Pas de cascade révocation auto (MVP: manuel seulement)

## Contexte technique

### Tables (P1.3.2 — migration `20260915165400_p1_3_2_delegation_schema.sql`)

```sql
-- role_delegations
CREATE TABLE role_delegations (
  id uuid PK DEFAULT gen_random_uuid(),
  delegator_role_id text NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  target_role_id text NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  permission_id text NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  delegation_type text NOT NULL CHECK IN ('use','manage','grant'),
  scope_type text NOT NULL DEFAULT 'global' CHECK IN ('global','role','user','self'),
  scope_value text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (delegator_role_id != target_role_id),
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

-- user_delegations
CREATE TABLE user_delegations (
  id uuid PK DEFAULT gen_random_uuid(),
  granter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  grantee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  permission_id text NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  delegation_type text NOT NULL CHECK IN ('use','manage','grant'),
  scope_type text NOT NULL DEFAULT 'global' CHECK IN ('global','role','user','self'),
  scope_value text,
  reason text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (granter_user_id != grantee_user_id),
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

-- role_assignability
CREATE TABLE role_assignability (
  assigner_role_id text NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assignable_role_id text NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (assigner_role_id, assignable_role_id),
  CHECK (assigner_role_id != assignable_role_id)
);
```

### RLS
- `role_delegations` : SELECT/ALL → Super Admin only
- `user_delegations` : SELECT → Super Admin + granter/grantee, ALL → Super Admin
- `role_assignability` : SELECT/ALL → Super Admin

### RPC futures (P1.3.4)
- `create_role_delegation()`, `create_user_delegation()`
- `revoke_role_delegation()`, `revoke_user_delegation()`
- `grant_role_to_user()`, `revoke_role_from_user()`
- `get_effective_authority()`, `has_effective_permission()`

---

## Conséquences

### Positives
- ✅ Délégation contrôlée, traçable, réversible
- ✅ Scopes granulaires (global → self)
- ✅ Anti-escalade multi-couches (SQL CHECK + RPC + RLS)
- ✅ Exception individuelle sans casser modèle rôle

### Négatives
- ⚠️ Complexité RPC moteur autorité (P1.3.4)
- ⚠️ Validation `scope_value` polymorphe (pas de FK propre)
- ⚠️ Pas de cascade révocation auto (MVP)

---

*Décision validée le 2026-09-15 — Appliquée via migration `20260915165400_p1_3_2_delegation_schema.sql` + conception P1.3.3*