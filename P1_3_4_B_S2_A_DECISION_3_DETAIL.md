# P1.3.4-B-S2-A.1 — DÉTAIL DÉCISION 3 : permissions rbac.*

## Tableau détaillé des 4 permissions `rbac.*` proposées

| Permission | Capability | Autorise concrètement | N'autorise PAS | Pourquoi nécessaire |
|---|---|---|---|---|
| `rbac.role_permissions` | **USE** | Lire la matrice rôle↔permission↔capacités (affichage UI Super Admin "Accès") | Modifier, attribuer, retirer des capacités | Super Admin doit voir la config ; Admin peut lire pour debug |
| | **MANAGE** | **Créer/modifier/supprimer** lignes dans `role_permissions` (upsert capacités USE/MANAGE/GRANT/DELEGATE sur un rôle pour une permission) | Créer des délégations, configurer assignabilité | Configuration centrale du RBAC : qui a quoi. Séparé de "gérer les users" |
| | **GRANT** | Donner à un autre rôle la capacité MANAGE/GRANT/DELEGATE sur `rbac.role_permissions` (métadélégation config) | Attribuer des rôles aux users, créer des délégations | Délégation de l'administration de la config RBAC elle-même |
| | **DELEGATE** | Créer des `role_delegations` ciblant la permission `rbac.role_permissions` | Donner des rôles, gérer users | Délégation fine : "X peut configurer les permissions du rôle Y" |
| `rbac.role_delegations` | **USE** | Lire toutes les délégations de rôle (audit, debug, UI "Délégations") | Créer, révoquer, modifier délégations | Visibilité sur les chaînes de délégation sans pouvoir les changer |
| | **MANAGE** | **Créer/révoquer** des `role_delegations` (via RPC `create_role_delegation`/`revoke_role_delegation`) | Configurer `role_permissions`, `role_assignability`, gérer users | Opération courante : déléguer une capacité. Séparé de la config des permissions |
| | **GRANT** | Déléguer MANAGE sur `rbac.role_delegations` à un autre rôle | Toucher aux permissions de base, aux users | "X peut gérer les délégations du périmètre Y" |
| | **DELEGATE** | Créer des délégations **sur** `rbac.role_delegations` (métadélégation) | Toute autre action | Rare : déléguer le droit de déléguer les délégations |
| `rbac.user_delegations` | **USE** | Lire les délégations user→user où on est granter/grantee (ou tout si super_admin) | Créer/révoquer | Transparence pour les parties concernées |
| | **MANAGE** | **Créer/révoquer** des `user_delegations` (via RPC `create_user_delegation`/`revoke_user_delegation`) | Configurer RBAC, gérer roles, attribuer rôles | Cas d'exception : délégation individuelle urgente. Traçable, auditable, séparée |
| | **GRANT** | Déléguer MANAGE sur `rbac.user_delegations` | Toute autre action | Très rare, super_admin seulement |
| | **DELEGATE** | Créer délégations sur `rbac.user_delegations` | Toute autre action | Quasi jamais utilisé |
| `rbac.role_assignability` | **USE** | Lire la matrice assigner↔assignable (UI "Qui peut attribuer quoi") | Modifier, configurer | Visibilité sans pouvoir changer les règles |
| | **MANAGE** | **Configurer** `role_assignability` (via RPC `set_role_assignability`) : ajouter/retirer paires assigner→assignable |Attribuer des rôles aux users, changer permissions, créer délégations | **Configuration structurelle** : définit les règles du jeu. Ne = pas attribution effective |
| | **GRANT** | Déléguer MANAGE sur `rbac.role_assignability` | Toute autre action | Super_admin seulement |
| | **DELEGATE** | Créer délégations sur `rbac.role_assignability` | Toute autre action | Quasi jamais utilisé |

---

## Qui reçoit typiquement quoi

| Rôle / Acteur | `rbac.role_permissions` | `rbac.role_delegations` | `rbac.user_delegations` | `rbac.role_assignability` |
|---|---|---|---|---|
| **Super Admin** | USE, MANAGE, GRANT, DELEGATE | USE, MANAGE, GRANT, DELEGATE | USE, MANAGE, GRANT, DELEGATE | USE, MANAGE, GRANT, DELEGATE |
| **Admin (si existe)** | USE | USE, MANAGE* | USE, MANAGE* | USE |
| **Rôle "RBAC Manager" (futur)** | USE, MANAGE | USE, MANAGE | USE | USE |
| **Autres** | — | — | — | — |

*Admin avec MANAGE sur délégations : seulement dans son scope (via délégation reçue), pas config globale.

---

## Pourquoi ces permissions ne font PAS doublon

### Avec `can_use` / `can_manage` / `can_grant` / `can_delegate` (capabilities)
- Les **capabilities** sont des **drapeaux sur une permission donnée** (colonne dans `role_permissions`)
- Les **permissions `rbac.*`** sont des **ressources distinctes** dans la table `permissions`
- Exemple : `role_permissions.can_manage = true` sur permission `rbac.role_delegations` = "peut gérer les délégations"
- Sans permission `rbac.role_delegations`, il n'y a **aucune ligne** dans `role_permissions` pour y attacher des capabilities

### Avec `role_assignability`
| Aspect | `role_assignability` | `rbac.role_assignability` (permission) |
|---|---|---|
| **Nature** | Table de configuration (règles statiques) | Permission (ressource autorisable) |
| **Contenu** | Paires `(assigner_role_id, assignable_role_id)` | Droits USE/MANAGE/GRANT/DELEGATE sur la config |
| **Rôle** | "Le rôle X *peut* attribuer le rôle Y" | "L'utilisateur U *a le droit de configurer* qui peut attribuer quoi" |
| **Utilisation** | Vérifiée DANS `assign_user_role` (règle métier) | Vérifiée AVANT `set_role_assignability` (autorisation config) |
| **Modifiable par** | Super Admin via RPC `set_role_assignability` | Super Admin (implicitement via MANAGE sur cette permission) |

**Distinction critique** :
- `role_assignability` = **règle** : "Admin peut attribuer Manager"
- `rbac.role_assignability` (permission MANAGE) = **autorisation de changer la règle** : "Super Admin décide qu'Admin peut attribuer Manager"

---

## RÉPONSE EXPLICITE À LA QUESTION CLÉ

### Est-ce que le modèle peut fonctionner avec les permissions métier existantes + les 4 capabilities, **sans** créer de nouvelles permissions `rbac.*` ?

**NON. Le modèle ne peut pas fonctionner correctement sans permissions `rbac.*` distinctes.**

### Pourquoi (précisément)

#### 1. Conflit de sémantique : Métier vs Configuration

| Permission métier | Sémantique | Si utilisée pour config RBAC |
|---|---|---|
| `users.change_role` | "Attribuer/retirer des rôles aux utilisateurs" | Deviens "configurer le RBAC" = confusion totale |
| `users.manage` | "Créer/supprimer des utilisateurs" | Deviens "gérer les permissions des rôles" = hors sujet |
| `users.promote_admin` | "Promouvoir en admin (workflow métier)" | Deviens "donner GRANT sur config RBAC" = escalade invisible |

**Exemple concret** : Un admin RH a `users.change_role` (MANAGE) pour embaucher/promouvoir des employés.
- Sans `rbac.*` : il a **implicitement** MANAGE sur la config RBAC → peut donner DELEGATE à n'importe qui → **fail-safe contourné**.
- Avec `rbac.*` : il a `users.change_role` (MANAGE) mais **pas** `rbac.role_permissions` (MANAGE) → peut attribuer des rôles existants, **pas** changer quelles capacités ils ont.

#### 2. Impossibilité d'exprimer "Lecture seule config RBAC"

- Besoin réel : Admin support lit la matrice permissions pour debug, **sans** pouvoir la modifier.
- Sans permission `rbac.role_permissions` distincte : soit il a `users.change_role` (USE) = peut voir users, **pas** la config RBAC ; soit on lui donne `users.change_role` (MANAGE) = peut modifier config RBAC → **pas de granularité**.

#### 3. Délégation impossible à cibler

- Besoin : Super Admin délègue à "RBAC Manager" le droit de **gérer les délégations** seulement.
- Sans `rbac.role_delegations` : impossible de donner DELEGATE sur "gestion délégations" sans donner DELEGATE sur tout (users, assessments, etc.).
- Avec `rbac.role_delegations` : `GRANT` sur `rbac.role_delegations` → délégation ciblée, auditable, révocable.

#### 4. `role_assignability` n'est PAS une permission

- `role_assignability` est une **table de règles** (configuration), pas une permission.
- Elle ne peut pas recevoir de capabilities (pas de colonnes can_use/can_manage...).
- Pour **autoriser sa modification**, il faut une **permission** sur laquelle attacher des capabilities → `rbac.role_assignability`.

#### 5. Séparation des responsabilités (SoC) / Principe moindre privilège

| Dimension | Permissions métier (`users.*`) | Permissions config (`rbac.*`) |
|---|---|---|
| **Public** | Admins, RH, Managers | Super Admin, Platform Owners |
| **Risque** | Impact utilisateurs | Impact **modèle de sécurité entier** |
| **Audit** | "Qui a changé le rôle de X ?" | "Qui a donné DELEGATE sur permissions ?" |
| **Fréquence** | Quotidienne | Rare, critique |
| **Délégation** | Courante (manager → lead) | Exceptionnelle, tracée |

Mélanger les deux = **violation du moindre privilège** : un admin users obtient implicitement le contrôle du moteur d'autorisation.

---

## Pourquoi les `rbac.*` restent nécessaires (même si "ça marcherait" techniquement)

1. **Sécurité** : Isolation du plan de contrôle (control plane) vs plan de données (data plane)
2. **Audit** : Traçabilité distincte : `rbac.role_permissions.modified` vs `users.change_role.assigned`
3. **Évolution** : Ajouter une capacité RBAC (ex: `can_revoke`) ne casse pas les permissions métier
4. **Frontend** : Menus séparés : "Administration > Utilisateurs" vs "Super Admin > RBAC > Permissions/Délégations/Assignabilité"
5. **Conformité** : Séparation des tâches (SoD) : qui gère les users ≠ qui configure l'autorisation
6. **Délégation future** : "Déléguer la gestion des délégations" n'a de sens que sur une permission dédiée

---

## Conclusion

| Question | Réponse |
|---|---|
| Modèle fonctionnel sans `rbac.*` ? | **NON** — conflation métier/config, pas de granularité, délégation impossible, `role_assignability` non autorisable |
| `rbac.*` redondantes avec capabilities ? | **NON** — capabilities s'attachent **à** une permission ; sans permission `rbac.*`, pas d'ancrage pour capabilities config |
| `rbac.*` redondantes avec `role_assignability` ? | **NON** — `role_assignability` = règles ; `rbac.role_assignability` (permission) = droit de changer les règles |

**Décision 3** : Les 4 permissions `rbac.*` (category='rbac') sont **nécessaires et non redondantes**.

---

**DECISION 3 = À VALIDER**

Prochaine étape : Votre validation finale des 4 décisions → GO pour S2-B.