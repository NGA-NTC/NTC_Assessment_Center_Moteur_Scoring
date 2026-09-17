---
id: ARCH-DELEGATION-001
title: Système de délégation
category: architecture
status: designed
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - delegation
  - rbac
  - roles
---

# Système de délégation

> **Statut : DESIGNED** — Tables créées (migration P1.3.2 appliquée), mais moteur de calcul d'autorité effective (RPC `get_effective_authority`) et mutations RPC **non encore implémentés** (prévus P1.3.4).

---

## Principe fondamental

La délégation dans NTC suit le principe : **on ne peut déléguer que ce qu'on possède, dans la portée qu'on possède**.

```
SUPER_ADMIN (racine)
    │
    ├── Peut TOUT déléguer (global)
    │
    ├── Délègue GRANT sur users.manage → ADMIN (scope: role:encadreur)
    │       │
    │       └── ADMIN peut maintenant attribuer rôle ENCADREUR
    │
    └── Délègue DELEGATE sur candidates.view → ADMIN (scope: role:encadreur)
            │
            └── ADMIN peut maintenant déléguer GRANT sur candidates.view à ENCADREUR
```

---

## Tables concernées

| Table | Description | État |
|-------|-------------|------|
| `role_delegations` | Délégation standard rôle → rôle | IMPLEMENTED (table + RLS) |
| `user_delegations` | Délégation exceptionnelle user → user | IMPLEMENTED (table + RLS) |
| `role_assignability` | Quels rôles un rôle peut attribuer | IMPLEMENTED (table + RLS) |

> Les tables existent (migration P1.3.2 appliquée). Le moteur de calcul et les RPC de mutation sont **DESIGNED**.

---

## 1. Délégation par rôle (`role_delegations`)

### Structure

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | Identifiant unique |
| `delegator_role_id` | text FK → roles(id) | Rôle délégateur |
| `target_role_id` | text FK → roles(id) | Rôle bénéficiaire |
| `permission_id` | text FK → permissions(id) | Permission déléguée |
| `delegation_type` | text | `use` \| `manage` \| `grant` |
| `scope_type` | text | `global` \| `role` \| `user` \| `self` |
| `scope_value` | text nullable | Ex: `role:encadreur` |
| `created_by` | uuid FK auth.users | Auteur |
| `created_at` / `expires_at` / `revoked_at` / `revoked_by` | Traçabilité |

### Contraintes (CHECK)

- `delegation_type` ∈ (`use`, `manage`, `grant`) — **PAS `delegate`**
- `scope_type` ∈ (`global`, `role`, `user`, `self`)
- `delegator_role_id != target_role_id` (anti-auto-délégation)
- `expires_at > created_at` / `revoked_at >= created_at`

### FK comportement

| FK | ON DELETE |
|----|-----------|
| `delegator_role_id` → roles | RESTRICT |
| `target_role_id` → roles | RESTRICT |
| `permission_id` → permissions | RESTRICT |
| `created_by` → auth.users | RESTRICT |
| `revoked_by` → auth.users | SET NULL |

### RLS

| Opération | Policy |
|-----------|--------|
| SELECT | Super Admin uniquement |
| INSERT/UPDATE/DELETE | Super Admin uniquement |

---

## 2. Délégation individuelle (`user_delegations`)

### Structure

| Colonne | Description |
|---------|-------------|
| `granter_user_id` | User qui délègue (doit avoir autorité) |
| `grantee_user_id` | User bénéficiaire |
| `permission_id` + `delegation_type` + `scope_type` + `scope_value` | Même modèle que rôle |
| `reason` | Justification (obligatoire pour exception) |
| `expires_at` / `revoked_at` / `revoked_by` | Cycle de vie |

### Contraintes

- `granter_user_id != grantee_user_id` (anti-self)
- `delegation_type` ∈ (`use`, `manage`, `grant`) — **PAS `delegate`**
- `scope_type` ∈ (`global`, `role`, `user`, `self`)

### RLS

| Opération | Policy |
|-----------|--------|
| SELECT | Super Admin + granter/grantee (parties concernées) |
| INSERT/UPDATE/DELETE | Super Admin uniquement |

> **Règle** : Une délégation individuelle est une **exception ciblée**. Elle ne donne **PAS** le droit de redéléguer. Le bénéficiaire ne reçoit **pas** `DELEGATE` via cette table.

---

## 3. Assignabilité des rôles (`role_assignability`)

### Structure

| Colonne | Description |
|---------|-------------|
| `assigner_role_id` | Rôle qui peut attribuer |
| `assignable_role_id` | Rôle attribuable |
| `created_by` / `created_at` | Traçabilité |

**PK composite** : `(assigner_role_id, assignable_role_id)`

### Contrainte

- `assigner_role_id != assignable_role_id` (anti-self)

### RLS

- SELECT/MANAGE : Super Admin uniquement

> **Règle** : `role_assignability` = configuration déclarative **seulement**. Ne donne **PAS** de droit effectif. L'attribution réelle nécessite :
> 1. `role_assignability` contient `(current_role, target_role)`
> 2. Capacité effective `ASSIGN_ROLE` sur le scope
> 3. Scope inclus dans l'autorité du grantor

---

## Cycle de vie d'une délégation

### Création (Super Admin uniquement)

```sql
-- Exemple : SUPER_ADMIN délègue GRANT sur candidates.edit à ADMIN (scope encadreur)
INSERT INTO role_delegations (
  delegator_role_id, target_role_id, permission_id,
  delegation_type, scope_type, scope_value, created_by
) VALUES (
  'super_admin', 'admin', 'candidates.edit',
  'grant', 'role', 'encadreur', super_admin_user_id
);
```

### Vérifications RPC (futur - P1.3.4)

1. **Autorité délégateur** : `has_effective_capability(granter, 'DELEGATE', perm, scope)`
2. **Scope inclus** : `scope_includes(scope_possédé, scope_demandé)` = TRUE
3. **Permission possédée** : `has_effective_permission(granter, perm, 'DELEGATE', scope)`
4. **Anti-escalade** : `delegator != target`, scope demandé ⊆ scope possédé
4. Insertion + audit log

### Révocation

- `revoked_at` + `revoked_by` obligatoires
- Pas de suppression physique (traçabilité)
- RPC `revoke_role_delegation` / `revoke_user_delegation`
- Effet immédiat : délégation ignorée dans calculs autorité

### Expiration

- `expires_at` optionnelle
- Vérifié à CHAQUE lecture : `expires_at IS NULL OR expires_at > now()`
- Délégation expirée = ignorée dans calculs autorité

---

## Scopes (portée)

| Scope | `scope_type` | `scope_value` | Signification |
|-------|--------------|---------------|---------------|
| Global | `global` | `NULL` | Partout |
| Par rôle | `role` | `role:encadreur` | Users ayant ce rôle |
| Par user | `user` | `user:uuid` | User spécifique |
| Soi-même | `self` | `NULL` | Soi-même uniquement |

### Inclusion de scope (`scope_includes`)

```sql
scope_includes(A, B) = TRUE si A inclut B
  global ⊃ tout
  role:A ⊃ user:X (si X a rôle A)
  self ⊃ rien d'autre
```

---

## Priorité et fusion des autorités

### Sources (priorité décroissante)

1. **User delegation** (exception ciblée) — priorité haute
2. **Role delegation** (héritée par rôle) — standard
3. **Role direct** (`role_permissions`) — base

### Fusion additive (pas d'écrasement)

```
Pour chaque (permission, scope):
  Pour chaque capacité (USE/MANAGE/GRANT/DELEGATE):
    result.capability = OR logique sur toutes les sources

Exemple:
  ROLE : MANAGE users / global
  USER_DELEGATION : USE users / user:X
  → Résultat : MANAGE global + USE user:X (fusion additive)
```

> **Règle** : Une `user_delegation` n'écrase **jamais** une autorité plus large. Elle ne fait qu'**AJOUTER** des capacités là où elles manquaient.

---

## Chaîne de délégation

```
SUPER_ADMIN (role)
  ├─ DELEGATE sur users.manage (global)
  │    └─→ ADMIN (role)
  │         ├─ GRANT sur users.manage (scope: role:encadreur)
  │         │    └─→ ENCADREUR (role)
  │         │         └─ USE sur users.view (scope: role:candidat)
  │         │              └─→ CANDIDAT (user)
  │         └─ DELEGATE sur users.view (scope: role:encadreur)
  │              └─→ ENCADREUR (role) [peut maintenant déléguer GRANT users.view]
  │
  └─ user_delegation (exception)
       SUPER_ADMIN (user) → GRANT users.promote_admin (global)
       └─→ USER_X (user)
```

### Représentation interne (RPC `get_effective_authority`)

| Colonne | Signification |
|---------|---------------|
| `chain_depth` | 0=direct, 1=1 niveau délégation, 2=2 niveaux... |
| `source` | `role` \| `role_delegation` \| `user_delegation` |
| `source_role_id` | Rôle source |
| `source_user_id` | User source (user_delegations) |
| `grantor_user_id` | Qui a accordé |
| `path` (interne) | `ARRAY[role_ids]` pour détection cycles |

---

## Anti-escalade dans la délégation

| Règle | Vérification |
|-------|--------------|
| Auto-délégation | CHECK `delegator != target` / `granter != grantee` |
| Permission non possédée | RPC vérifie `has_effective_permission(DELEGATE)` avant INSERT |
| Niveau supérieur | Vérifie `can_delegate` effectif sur perm+scope |
| Élargissement scope | `scope_includes(scope_possédé, scope_demandé)` = TRUE |
| Redélégation non autorisée | Bénéficiaire délégation n'a PAS `can_delegate` via cette délégation |
| Cycle | `path ARRAY[role_ids]` + `NOT role_id = ANY(path)` + limite profondeur 5 |
| Révocation contournée | `revoked_at IS NULL` vérifié à CHAQUE lecture RPC |
| Expiration contournée | `expires_at > now()` vérifié à CHAQUE lecture |

---

## Exemples concrets

### 1. SUPER_ADMIN → ADMIN (standard)

```sql
-- SUPER_ADMIN donne à ADMIN le droit d'attribuer le rôle ENCADREUR
INSERT INTO role_assignability (assigner_role_id, assignable_role_id, created_by)
VALUES ('admin', 'encadreur', super_admin_id);

-- SUPER_ADMIN délègue GRANT sur candidates.edit à ADMIN (scope encadreur)
INSERT INTO role_delegations (delegator_role_id, target_role_id, permission_id,
  delegation_type, scope_type, scope_value, created_by)
VALUES ('super_admin', 'admin', 'candidates.edit', 'grant', 'role', 'encadreur', super_admin_id);

-- SUPER_ADMIN donne à ADMIN la capacité de déléguer GRANT sur candidates.view
INSERT INTO role_delegations (delegator_role_id, target_role_id, permission_id,
  delegation_type, scope_type, scope_value, created_by)
VALUES ('super_admin', 'admin', 'candidates.view', 'delegate', 'role', 'encadreur', super_admin_id);
```

### Résultat

- ADMIN peut maintenant : `grant_role_to_user(admin_id, user_id, 'encadreur')`
- ADMIN peut déléguer `grant` sur `candidates.view` aux ENCADREURS
- ADMIN **ne peut PAS** : créer SUPER_ADMIN, attribuer ADMIN, déléguer hors scope encadreur

### Exception individuelle

```sql
-- SUPER_ADMIN donne exceptionnellement à USER_X le MANAGE sur pages (scope encadreur)
INSERT INTO user_delegations (granter_user_id, grantee_user_id, permission_id,
  delegation_type, scope_type, scope_value, reason, expires_at, created_by)
VALUES (super_admin_id, user_x_id, 'pages.manage', 'manage', 'role', 'encadreur',
        'Projet temporaire - gestion pages encadreurs', '2026-12-31', super_admin_id);
```

- USER_X a `MANAGE pages` (scope `role:encadreur`)
- USER_X **ne peut PAS** redéléguer cette permission
- Expire auto le 2026-12-31

---

## Anti-escalade dans la délégation

| Règle | Implémentation |
|-------|----------------|
| Auto-délégation | CHECK `delegator != target` / `granter != grantee` |
| Délégation perm non possédée | RPC vérifie `has_effective_capability(DELEGATE)` avant INSERT |
| Niveau supérieur | Vérifie `can_delegate` effectif du délégateur sur perm+scope |
| Élargissement scope | `scope_includes(scope_possédé, scope_demandé)` = TRUE |
| Redélégation non autorisée | Bénéficiaire délégation n'a PAS `DELEGATE` via cette délégation |
| Élargissement scope | Scope délégué ⊆ scope possédé (vérifié RPC) |

---

## Cycle de vie

| Événement | Traitement |
|-----------|------------|
| Création | INSERT + vérifications RPC (anti-escalade, scope, autorité) |
| Lecture | `expires_at > now()` + `revoked_at IS NULL` + `scope_includes` |
| Révocation | UPDATE `revoked_at` + `revoked_by` (pas de DELETE) |
| Expiration | Ignorée si `expires_at <= now()` |
| Révocation cascade | MVP: non. Futur: optionnel |

---

## Exemple complet : SUPER_ADMIN → ADMIN → ENCADREUR

```sql
-- 1. SUPER_ADMIN crée rôle ENCADREUR
INSERT INTO roles (id, name, parent_id, hierarchy_level, is_assignable)
VALUES ('encadreur', 'Encadreur', 'admin', 2, true);

-- 2. Permissions de base ENCADREUR
INSERT INTO role_permissions (role_id, permission_id, can_use, can_manage)
VALUES ('encadreur', 'candidates.view', true, false),
       ('encadreur', 'candidates.edit', true, true);

-- 3. SUPER_ADMIN autorise ADMIN à attribuer ENCADREUR
INSERT INTO role_assignability (assigner_role_id, assignable_role_id, created_by)
VALUES ('admin', 'encadreur', super_admin_id);

-- 4. SUPER_ADMIN délègue GRANT sur candidates.edit à ADMIN (scope encadreur)
INSERT INTO role_delegations (delegator_role_id, target_role_id, permission_id,
  delegation_type, scope_type, scope_value, created_by)
VALUES ('super_admin', 'admin', 'candidates.edit', 'grant', 'role', 'encadreur', super_admin_id);

-- 5. SUPER_ADMIN délègue DELEGATE sur candidates.view à ADMIN
INSERT INTO role_delegations (delegator_role_id, target_role_id, permission_id,
  delegation_type, scope_type, scope_value, created_by)
VALUES ('super_admin', 'admin', 'candidates.view', 'delegate', 'role', 'encadreur', super_admin_id);

-- 6. ADMIN attribue ENCADREUR à un user
SELECT grant_role_to_user(admin_id, target_user_id, 'encadreur');

-- 7. ADMIN délègue GRANT sur candidates.view à ENCADREUR
INSERT INTO role_delegations (delegator_role_id, target_role_id, permission_id,
  delegation_type, scope_type, scope_value, created_by)
VALUES ('admin', 'encadreur', 'candidates.view', 'grant', 'role', 'candidat', admin_id);
```

---

## Matrice récapitulative

| Action | Table | Qui | Vérifications |
|--------|-------|-----|---------------|
| Créer délégation rôle | `role_delegations` | Super Admin (ou RPC futur) | `has_effective_capability(DELEGATE)`, scope inclus, perm possédée |
| Créer délégation user | `user_delegations` | Super Admin | Même vérifs + `granter != grantee` + `reason` |
| Attribuer rôle | `user_roles` | User avec `ASSIGN_ROLE` effectif | `role_assignability` + `ASSIGN_ROLE` effectif + scope |
| Révoquer délégation | UPDATE `revoked_at` | Super Admin / Granter | Traçabilité |
| Révoquer rôle | DELETE `user_roles` | User avec `REVOKE_ROLE` | `assigned_by` traçabilité |

---

## Récapitulatif des tables de délégation

| Table | PK | FK principales | RLS | État |
|-------|----|----------------|-----|------|
| `role_delegations` | `id` (uuid) | delegator/target/perm → roles/permissions | Super Admin only | IMPLEMENTED |
| `user_delegations` | `id` (uuid) | granter/grantee → auth.users, perm → permissions | Super Admin + own | IMPLEMENTED |
| `role_assignability` | (assigner, assignable) | assigner/assignable → roles | Super Admin only | IMPLEMENTED |

> **Rappel** : Tables créées (P1.3.2). Moteur calcul + RPC mutations = **DESIGNED** (P1.3.4).

---

*Dernière mise à jour : 2026-09-15*