---
id: ARCH-AUTHORIZATION-001
title: Autorisation (RBAC + Délégation)
category: architecture
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - authorization
  - rbac
  - delegation
  - permissions
---

# Autorisation (RBAC + Délégation)

## Modèle conceptuel

NTC utilise un modèle **RBAC hiérarchique avec délégation explicite**. L'autorité ne vient **pas** du nom du rôle, mais des **permissions effectives** calculées dynamiquement.

---

## 4 concepts distincts

| Concept | Question | Exemples |
|---------|----------|----------|
| **ROLE** | "Qu'est-ce que l'utilisateur EST ?" | `super_admin`, `admin`, `candidate`, `encadreur` |
| **AUTHENTICATION STATE** | "Comment l'utilisateur SE CONNECTE ?" | `anonymous`, `authenticated` |
| **ACCESS AUDIENCE** | "QUI peut accéder à cette RESSOURCE ?" | `public`, `authenticated`, `role_based` |
| **PERMISSION / CAPABILITY** | "QUELLE action est autorisée ?" | `USE`, `MANAGE`, `GRANT`, `DELEGATE` |

> **Règle d'or** : `public` ≠ rôle. Un visiteur anonyme n'existe **jamais** dans `user_roles`.

---

## Modèle de permissions

### Catalogue (`permissions` table)

| ID | Catégorie | Description |
|----|-----------|-------------|
| `users.view` | users | Lister/consulter utilisateurs |
| `users.edit` | users | Modifier infos utilisateurs |
| `users.manage` | users | Créer/supprimer utilisateurs |
| `users.change_role` | users | Attribuer/retirer rôles |
| `users.promote_admin` | users | Promouvoir en admin |
| `users.promote_super_admin` | users | Promouvoir en super_admin |
| `profile.view` | profile | Consulter son profil |
| `profile.edit` | profile | Modifier son profil |
| `assessment.take` | assessment | Passer les batteries |
| `assessment.evaluate` | assessment | Noter/commenter réponses |
| `results.view` | results | Consulter résultats |
| `reports.view` | reports | Générer/consulter rapports |

---

## Capacités (4 niveaux indépendants)

| Code | Nom | Description |
|------|-----|-------------|
| `USE` | Utiliser | Lire, exécuter, consulter |
| `MANAGE` | Gérer | CRUD complet sur la ressource |
| `GRANT` | Accorder | Attribuer cette permission à d'autres |
| `DELEGATE` | Déléguer | Permettre à un autre rôle de GRANT cette permission |

> **Règle stricte** : Aucune inclusion automatique. `MANAGE` ⇏ `GRANT` ⇏ `DELEGATE`. Chaque drapeau géré explicitement.

### Stockage : `role_permissions`

| Colonne | Type | Défaut | Signification |
|---------|------|--------|---------------|
| `can_use` | boolean | false | Peut utiliser |
| `can_manage` | boolean | false | Peut gérer (CRUD) |
| `can_grant` | boolean | false | Peut accorder à d'autres |
| `can_delegate` | boolean | false | Peut déléguer le GRANT |

> **Migration P1.3.1** : Anciennes permissions → `can_use = true` (comportement historique). Les 3 autres restent `false` jusqu'à attribution explicite.

---

## Rôles (table `roles`)

| Colonne | Rôle |
|---------|-------|
| `id` | PK text (ex: `candidate`, `admin`, `super_admin`) |
| `name` | Label affiché |
| `description` | Description |
| `is_system` | Rôle système (non supprimable) |
| `parent_id` | FK → `roles.id` (info hiérarchique only) |
| `hierarchy_level` | Niveau (info only) |
| `is_assignable` | Peut être attribué |

> **Important** : `parent_id`, `hierarchy_level`, `is_assignable` sont **structurels uniquement**. Ne constituent PAS une preuve d'autorité.

### Rôles système (seed)

| ID | Name | Description | is_system |
|----|------|-------------|-----------|
| `candidate` | Candidat | Passe les assessments | true |
| `admin` | Administrateur | Accès complet admin | true |
| `super_admin` | Super Administrateur | Propriétaire système | true |

---

## Hiérarchie des rôles (structurelle)

```
super_admin (level 0)
    └── admin (level 1)
        └── encadreur (level 2) — futur
            └── candidat (level 3)
```

> **Règle** : La hiérarchie est **structurelle only**. L'autorité réelle = permissions effectives + délégations + scopes. `parent_id` ne donne **jamais** de permission implicite.

---

## Capacités de gestion (métadonnées)

| Capacité | Description | Vérifiée via |
|----------|-------------|--------------|
| `CREATE_ROLE` | Créer un rôle | `role_permissions.can_use` sur `roles.create` |
| `MANAGE_ROLE` | Modifier/supprimer rôle | `role_permissions.can_manage` sur `roles.manage` |
| `ASSIGN_ROLE` | Attribuer rôle à user | `role_assignability` + capacité effective `ASSIGN_ROLE` |
| `REVOKE_ROLE` | Retirer rôle | Capacité effective `REVOKE_ROLE` |
| `DELEGATE_ROLE_ASSIGNMENT` | Autoriser attribution rôle | `role_delegations` (grant sur `roles.assign`) |

> Ces capacités ne sont PAS des permissions dans `permissions` — ce sont des **concepts d'autorisation** vérifiés par les RPC.

---

## Délégation (P1.3.2 - DESIGNED)

### `role_delegations` (rôle → rôle)

| Colonne | Description |
|---------|-------------|
| `delegator_role_id` | Rôle qui délègue |
| `target_role_id` | Rôle bénéficiaire |
| `permission_id` | Permission déléguée |
| `delegation_type` | `use` \| `manage` \| `grant` |
| `scope_type` | `global` \| `role` \| `user` \| `self` |
| `scope_value` | Valeur (ex: `role:encadreur`) |
| `created_by` / `created_at` / `expires_at` / `revoked_at` / `revoked_by` | Traçabilité |

> `delegation_type` = `use` | `manage` | `grant` — **PAS `delegate`**. `DELEGATE` = capacité portée par `role_permissions.can_delegate`.

### `user_delegations` (user → user, exception)

| Colonne | Description |
|---------|-------------|
| `granter_user_id` / `grantee_user_id` | User source / bénéficiaire |
| `permission_id` + `delegation_type` + `scope_type` + `scope_value` | Même modèle |
| `reason` | Justification obligatoire |
| `expires_at` / `revoked_at` | Expiration / révocation |

> **Règle** : Une délégation individuelle ne donne **PAS** le droit de redéléguer. `DELEGATE` doit être explicite.

---

## `role_assignability` (Quels rôles un rôle peut attribuer)

| Colonne | Description |
|---------|-------------|
| `assigner_role_id` | Rôle qui peut attribuer |
| `assignable_role_id` | Rôle attribuable |
| `created_by` / `created_at` | Traçabilité |

**PK composite** : `(assigner_role_id, assignable_role_id)`

> **Règle** : `role_assignability` = configuration déclarative **seulement**. Ne donne PAS de droit effectif. Il faut capacité effective `ASSIGN_ROLE` + scope.

---

## Scopes (portée d'autorité)

| Scope | Signification | `scope_value` | Inclusion |
|-------|---------------|---------------|-----------|
| `global` | Partout | `NULL` | Le plus large |
| `role` | Users ayant ce rôle | `role:encadreur` | `role:A` ⊂ `global` |
| `user` | User spécifique | `user:uuid` | `user:X` ⊂ `role:R` si X a rôle R |
| `self` | Soi-même | `NULL` | Le plus restreint |

**Hiérarchie d'inclusion :** `global` ⊃ `role:R` ⊃ `user:U` (si U a rôle R) ⊃ `self`

### Fonction `scope_includes` (à implémenter)

```sql
CREATE OR REPLACE FUNCTION scope_includes(
  scope_type_a text, scope_value_a text,
  scope_type_b text, scope_value_b text
) RETURNS boolean
```
- `global` inclut tout
- `role:A` inclut `user:X` si X a rôle A
- `self` n'inclut rien d'autre

---

## Calcul de l'autorité effective

### Sources d'autorité (priorité décroissante)

1. **Rôle direct** (`role_permissions`) — base
2. **Délégation rôle→rôle** (`role_delegations`) — héritée par tous users du rôle
3. **Délégation user→user** (`user_delegations`) — exception ciblée, priorité haute

### Fusion (pas d'écrasement)

```
Pour chaque (permission, scope):
  Pour chaque capacité (USE/MANAGE/GRANT/DELEGATE):
    result = OR logique sur toutes les sources

Exemple:
  ROLE: MANAGE users / global
  USER_DELEGATION: USE users / user:X
  → Résultat: MANAGE global + USE user:X (fusion additive)
```

> **Règle** : Une délégation individuelle n'écrase **jamais** une autorité plus large. Elle ne fait qu'AJOUTER.

---

## Anti-escalade (règles dures)

| Interdiction | Vérification |
|--------------|--------------|
| Auto-attribution permission | `granter != grantee` / `delegator != target` |
| Auto-attribution rôle | `granter_id != target_user_id` |
| Création rôle supérieur | Capacité effective `CREATE_ROLE` + scope |
| Attribution rôle hors scope | `role_assignability` + capacité effective `ASSIGN_ROLE` |
| Délégation perm non possédée | `has_effective_capability(DELEGATE)` requis |
| Délégation niveau supérieur | `can_delegate` effectif sur perm+scope |
| Élargissement scope | `scope_includes(scope_possédé, scope_demandé)` = TRUE |
| Redélégation non autorisée | Bénéficiaire délégation n'a PAS `DELEGATE` via cette délégation |
| Contournement révocation | `revoked_at IS NULL` vérifié à CHAQUE lecture RPC |
| Contournement expiration | `expires_at IS NULL OR expires_at > now()` vérifié à CHAQUE lecture |

---

## RLS (Row Level Security) - Résumé

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| `profiles` | own / admin / super_admin | own / admin / super_admin / delete super_admin |
| `roles` | all authenticated | admin / super_admin |
| `permissions` | all authenticated | admin / super_admin |
| `role_permissions` | all authenticated | admin / super_admin |
| `user_roles` | own / admin / super_admin | admin+perm / super_admin+perm |
| `pages` / `features` / `page_features` | all authenticated | admin / super_admin |
| `role_delegations` | super_admin | super_admin |
| `user_delegations` | super_admin + own (granter/grantee) | super_admin |
| `role_assignability` | super_admin | super_admin |

> **Pas de `USING(true)`** sur tables sensibles (délégations, assignability).

---

## Matrice capacités par rôle (actuel - seed)

| Permission | candidate | admin | super_admin |
|------------|-----------|-------|-------------|
| `profile.view` | USE | USE | USE |
| `profile.edit` | USE | USE | USE |
| `assessment.take` | USE | USE | USE |
| `users.view` | — | USE | USE |
| `users.edit` | — | USE | USE |
| `users.manage` | — | USE | USE |
| `users.change_role` | — | USE | USE |
| `users.promote_admin` | — | — | USE |
| `users.promote_super_admin` | — | — | USE |
| `assessment.take` | USE | USE | USE |
| `assessment.evaluate` | — | USE | USE |
| `results.view` | — | USE | USE |
| `reports.view` | — | USE | USE |

> **Note** : Actuellement, seul `can_use = true` est positionné (migration P1.3.1). Les capacités `MANAGE`/`GRANT`/`DELEGATE` sont à `false` — à activer explicitement par Super Admin.

---

## Vérification côté frontend

```js
// UserAuthContext
hasRole('admin')           // boolean
hasPermission('users.edit') // boolean (via role_permissions.current)
isAdmin                    // admin || super_admin
```

> **Important** : Frontend = UX only. Vraie sécurité = RLS + RPC + Edge Functions.

---

## Résumé : ce qui est IMPLEMENTED vs DESIGNED

| Composant | État |
|-----------|------|
| Tables `roles`, `permissions`, `role_permissions`, `user_roles`, `profiles` | IMPLEMENTED |
| RLS de base (profiles, roles, permissions, user_roles) | IMPLEMENTED |
| RPC `has_role`, `has_permission`, `admin_get_users`, `admin_reset_user_password`, `bootstrap_super_admin`, `promote_to_admin` | IMPLEMENTED |
| Tables `pages`, `features`, `page_features` + RLS | IMPLEMENTED |
| Tables `role_delegations`, `user_delegations`, `role_assignability` + RLS | **IMPLEMENTED (migration P1.3.2 appliquée)** |
| Colonnes `can_use/manage/grant/delegate` sur `role_permissions` | IMPLEMENTED (migration P1.3.1) |
| Colonnes `parent_id`, `hierarchy_level`, `is_assignable` sur `roles` | IMPLEMENTED (P1.3.1) |
| Colonnes `expires_at`, `revoked_at`, `revoked_by` sur `user_roles` | IMPLEMENTED (P1.3.1) |
| **Moteur calcul autorité effective (RPC `get_effective_authority`)** | **DESIGNED (P1.3.3)** — pas encore implémenté |
| **RPC mutations délégation/attribution** | **DESIGNED** |
| **Calcul scopes, fusion autorités, anti-escalade** | **DESIGNED** |

---

*Dernière mise à jour : 2026-09-15*