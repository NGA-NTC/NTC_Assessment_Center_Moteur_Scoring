# P1.3.4-B-S2-A.1 — DÉCISIONS BLOQUANTES

## Décision 1 — role scope

### 1. Problème exact constaté dans le schéma actuel

Les tables `role_delegations` et `user_delegations` autorisent toutes deux `scope_type = 'role'` avec un `scope_value` de type `text` (référence à `roles.id`). Cependant, **aucune documentation ni code n'explicite la sémantique précise** de ce scope.

Dans `scope_includes()` (S1), le cas `role` → `user` est implémenté : un scope `role` inclut un scope `user` **si l'utilisateur (scope_value_b) possède le rôle (scope_value_a)**. Mais il n'y a **aucun cas pour `role` → `role`** ni `role` → `global`.

### 2. Valeurs actuellement présentes dans la DB

**Aucune donnée existante** dans `role_delegations` ni `user_delegations` (tables créées vides en P1.3.2). Les migrations n'insèrent aucune délégation initiale.

Rôles actuels (depuis migrations) :
| id | name | parent_id | hierarchy_level | is_assignable |
|---|---|---|---|---|
| candidate | Candidat | NULL | 0 (défaut) | true |
| admin | Administrateur | NULL | 0 (défaut) | true |
| super_admin | Super Administrateur | NULL | 0 (défaut) | true |

Tous ont `hierarchy_level = 0` et `parent_id = NULL` par défaut.

### 3. Options possibles

| Option | Sémantique | scope_includes implication |
|---|---|---|
| **A. Rôle du BÉNÉFICIAIRE** | `scope_value` = rôle que doit avoir l'utilisateur cible pour bénéficier de la délégation | `scope_includes(role:X, user:U)` → TRUE si U a rôle X (déjà codé) |
| **B. Périmètre d'APPLICATION** | `scope_value` = rôle définissant le périmètre (ex: "dans le scope du rôle manager") | Nécessite nouvelle logique : `scope_includes(role:X, role:Y)` selon parent_id/hierarchy |
| **C. Rôle du DÉLÉGUATEUR** | `scope_value` = rôle qui délègue (redondant avec delegator_role_id) | Incohérent : delegator_role_id existe déjà |
| **D. Interdire** | `scope_type='role'` non autorisé dans délégations | Simplifie, force `global` ou `user` |

### 4. Conséquences par option

| Aspect | Option A (Rôle bénéficiaire) | Option B (Périmètre) | Option D (Interdire) |
|---|---|---|---|
| **RBAC** | Naturel : délégation à "tous les managers" | Complexe : nécessite hiérarchie rôles | Simple : délégations ciblées uniquement |
| **Délégation** | `role_delegation` target_role_id + scope role = "ce rôle délègue à tous ceux qui ont ce rôle" | Chaînes complexes, scope élargi possible | Délégations explicites user→user ou role→role |
| **Scopes** | Cohérent avec `scope_includes` actuel | Casse `scope_includes` (role⊃role non défini) | `scope_includes` inchangé |
| **Anti-escalade** | Vérifiable : scope délégué ⊆ rôles déléguateur | Risque élargissement via parent_id | Plus strict, pas d'ambiguïté |
| **Frontend** | UI : "Déléguer à tous les [Rôle X]" | UI confuse : "Dans le périmètre du rôle X" | UI simple : user ou global |

### 5. Recommandation technique

**Option A — Rôle du bénéficiaire** (alignée avec `scope_includes` existant).

Rationale :
- `scope_includes('role', 'manager', 'user', 'user-123')` déjà implémenté et testé
- Sémantique claire : "cette délégation s'applique à tout utilisateur possédant le rôle X"
- `role_delegations` : `delegator_role_id` délègue à `target_role_id` **pour les users ayant `scope_value`**
- `user_delegations` : `granter_user_id` délègue à `grantee_user_id` **seulement quand grantee agit avec rôle `scope_value`**

### 6. Modifications de schéma nécessaires

**Aucune modification de schéma** (colonnes existent). Seulement :
- Documentation commentaire sur colonnes `scope_type`/`scope_value`
- Éventuel CHECK constraint : `scope_type='role'` ⇒ `scope_value` NOT NULL
- Tests unitaires `scope_includes` pour valider

### 7. Compatibilité migrations existantes

**100% compatible** : tables créées vides, aucune donnée à migrer, `scope_includes` déjà gère `role→user`.

---

## Décision 2 — self scope

### 1. Problème exact constaté dans le schéma actuel

`scope_type = 'self'` est autorisé par les CHECK constraints dans `role_delegations` et `user_delegations` (valeur dans `('global','role','user','self')`). Mais :
- `scope_includes('self', null, *, *)` retourne **toujours FALSE** (ligne 52-54 S1)
- CHECK `no_self_delegation` interdit `delegator_role_id = target_role_id` et `granter_user_id = grantee_user_id`
- Une délégation `self` ne pourrait **jamais** être utilisée par personne d'autre que le délégateur lui-même (interdit par CHECK)

### 2. Valeurs actuellement présentes dans la DB

Aucune (tables vides).

### 3. Options possibles

| Option | Description |
|---|---|
| **A. Autoriser `self`** | Garder dans CHECK, documenter usage |
| **B. Interdire `self`** | Retirer `'self'` des CHECK constraints `scope_type_check` |

### 4. Conséquences par option

| Aspect | Option A (Autoriser) | Option B (Interdire) |
|---|---|---|
| **RBAC** | Incohérent : capacité inutilisable | Propre : scopes = global/role/user |
| **Délégation** | "Délégation à soi-même" = oxymore | Pas de cas limite |
| **Scopes** | `scope_includes` doit être étendu (self⊃self ?) | `scope_includes` inchangé |
| **Anti-escalade** | Risque confusion : self ≠ délégation | Élimine ambiguïté |
| **Frontend** | Option UI inutile/confuse | UI plus simple |

### 5. Recommandation technique

**Option B — Interdire `self` dans les délégations.**

Rationale :
- `self` a du sens pour **permissions directes** (ex: "user peut modifier son propre profil" via RLS `auth.uid() = id`)
- `self` n'a **aucun sens pour une délégation** : une délégation implique **deux acteurs distincts**
- Le CHECK `no_self_delegation` prouve l'intention : pas d'auto-délégation
- `scope_includes('self', ...)` retourne FALSE → délégation inutilisable

### 6. Modifications de schéma nécessaires

Migration unique :
```sql
-- role_delegations
alter table public.role_delegations drop constraint role_delegations_scope_type_check;
alter table public.role_delegations add constraint role_delegations_scope_type_check
  check (scope_type in ('global', 'role', 'user'));

-- user_delegations
alter table public.user_delegations drop constraint user_delegations_scope_type_check;
alter table public.user_delegations add constraint user_delegations_scope_type_check
  check (scope_type in ('global', 'role', 'user'));
```

### 7. Compatibilité migrations existantes

**Compatible** : tables vides, aucune donnée à nettoyer. `scope_includes` n'a pas besoin de modification (déjà FALSE pour self).

---

## Décision 3 — manage permissions

### 1. Problème exact constaté dans le schéma actuel

Le modèle S1 a introduit **4 capacités indépendantes** sur `role_permissions` :
- `can_use` (USE)
- `can_manage` (MANAGE)
- `can_grant` (GRANT)
- `can_delegate` (DELEGATE)

La spécification S2-A propose de créer de **nouvelles permissions** du type `xxx.manage` (ex: `role_permissions.manage`, `role_delegations.manage`) pour contrôler qui peut **exécuter les mutations RPC**.

**Question** : Faut-il créer ces permissions, ou la capacité `MANAGE` sur la permission existante suffit-elle ?

### 2. Valeurs actuellement présentes dans la DB

Permissions existantes (migrations) :
| id | category |
|---|---|
| users.view | users |
| users.edit | users |
| users.manage | users |
| users.change_role | users |
| users.promote_admin | users |
| users.promote_super_admin | users |
| profile.view | profile |
| profile.edit | profile |
| assessment.take | assessment |
| assessment.evaluate | assessment |
| results.view | results |
| reports.view | reports |

**Aucune permission** `role_permissions.*`, `role_delegations.*`, `user_delegations.*`, `role_assignability.*` n'existe.

Capacités sur permissions existantes : toutes à `can_use=true` seulement (migration P1.3.1 ligne 36-38). `can_manage`, `can_grant`, `can_delegate` = FALSE pour tout le monde sauf super_admin (à configurer).

### 3. Options possibles

| Option | Modèle |
|---|---|
| **A. Nouvelles permissions `xxx.manage`** | Créer `role_permissions.manage` (permission), donner `can_manage=true` à super_admin |
| **B. Réutiliser permissions existantes + capability MANAGE** | `users.change_role` avec `can_manage=true` = droit de gérer les rôles |
| **C. Hybride** | Nouvelles permissions pour tables RBAC, existantes pour métier |

### 4. Conséquences par option

| Aspect | Option A (Nouvelles permissions) | Option B (Réutiliser) | Option C (Hybride) |
|---|---|---|---|
| **RBAC** | Granulaire : chaque table a sa permission | Conflit : `users.change_role` = métier + config RBAC | Séparation claire métier/config |
| **Délégation** | DELEGATE sur `role_permissions.manage` possible | DELEGATE sur `users.change_role` = déléguer gestion users + RBAC | DELEGATE ciblé |
| **Scopes** | Scope par table RBAC | Scope unique `users.change_role` | Scopes séparés |
| **Anti-escalade** | Contrôle fin : qui peut toucher à `role_delegations` | Risque : admin users obtient config RBAC | Maître : super_admin contrôle config |
| **Frontend** | Plus de permissions à afficher | Moins de permissions | Modéré |

### 5. Recommandation technique

**Option C — Hybride (recommandée) / Option A pour tables RBAC pures.**

Distinction fondamentale :
- **Permission** = ressource métier (users, assessments, results...)
- **Capability** = action sur cette ressource (USE, MANAGE, GRANT, DELEGATE)

Les tables `role_permissions`, `role_delegations`, `user_delegations`, `role_assignability` sont de la **configuration RBAC**, pas du métier. Elles ne devraient pas être mélangées avec `users.change_role`.

**Recommandation précise** :
1. Créer permissions **configuration** : `rbac.role_permissions`, `rbac.role_delegations`, `rbac.user_delegations`, `rbac.role_assignability` (category = 'rbac')
2. Super_admin a `can_manage=true` + `can_grant=true` + `can_delegate=true` sur ces permissions
3. Admin (si existe) a `can_use=true` seulement (lecture)
4. `users.change_role` garde sa sémantique métier : attribuer rôles aux users

### 6. Modifications de schéma nécessaires

Nouvelles permissions (insert dans `permissions`) :
```sql
('rbac.role_permissions', 'Gérer permissions rôles', 'Attribuer/retirer capacités aux rôles', 'rbac'),
('rbac.role_delegations', 'Gérer délégations rôles', 'Créer/révoquer délégations par rôle', 'rbac'),
('rbac.user_delegations', 'Gérer délégations users', 'Créer/révoquer délégations individuelles', 'rbac'),
('rbac.role_assignability', 'Gérer assignabilité rôles', 'Configurer quels rôles peuvent en attribuer d''autres', 'rbac');
```

Puis `role_permissions` pour super_admin avec les 4 capabilities.

### 7. Compatibilité migrations existantes

**Compatible** : nouvelles permissions s'ajoutent, aucune existante modifiée. `users.change_role` inchangée.

---

## Décision 4 — hierarchy_level = 0

### 1. Problème exact constaté dans le schéma actuel

Colonne `hierarchy_level` ajoutée en P1.3.1 avec `DEFAULT 0`. Tous les rôles existants (candidate, admin, super_admin) ont `hierarchy_level = 0` et `parent_id = NULL`.

Le commentaire migration P1.3.1 ligne 20-22 : *"parent_id est une information de hiérarchie uniquement. Il ne constitue PAS une preuve d'autorité."*

### 2. Valeurs actuellement présentes dans la DB

| Role | hierarchy_level | parent_id | is_assignable |
|---|---|---|---|
| candidate | 0 | NULL | true |
| admin | 0 | NULL | true |
| super_admin | 0 | NULL | true |

**Tous à 0** = niveau non défini / racine plate.

### 3. Options possibles

| Option | Sémantique |
|---|---|
| **A. Purement structurel (métadonnée)** | `hierarchy_level` = info visuelle/docs, **jamais** utilisé dans autorisation |
| **B. Garde-fou anti-escalade** | Vérification : `hierarchy_level(cible) <= hierarchy_level(acteur)` dans `assign_user_role` |
| **C. Racine = 0, enfants > 0** | 0 = pas de parent / niveau supérieur. Rôles enfants ont level > 0 |

### 4. Conséquences par option

| Aspect | Option A (Structurel pur) | Option B (Garde-fou) | Option C (Racine=0) |
|---|---|---|---|
| **RBAC** | Respecte modèle : structure ≠ autorité | Ajoute contrainte implicite | Nécessite peupler niveaux cohérents |
| **Délégation** | Sans impact | Sans impact direct | Sans impact direct |
| **Scopes** | Sans impact | Sans impact | Sans impact |
| **Anti-escalade** | Dépend seulement capabilities + scope | Couche supplémentaire : level cible ≤ level acteur | Idem B si niveaux peuplés |
| **Frontend** | Affichage arborescence seulement | Pas d'affichage niveau requis | Arborescence visuelle |

### 5. Recommandation technique

**Option A — Purement structurel (métadonnée), NE PAS utiliser comme garde-fou.**

Rationale forte :
1. **Principe architectural validé** : *"parent_id / hierarchy_level / is_assignable sont structurels et ne donnent pas automatiquement une autorité"*
2. **Risque Option B** : Transforme une métadonnée en règle d'autorisation implicite. Si super_admin a level 0 (actuel) et admin level 1, super_admin ne pourrait pas attribuer admin (0 ≤ 1 faux). Il faudrait inverser (super_admin = 100, admin = 10) → complexité.
3. **L'anti-escalade existe déjà** : capabilities (GRANT) + scope + role_assignability + is_assignable suffisent.
4. **Flexibilité future** : Hiérarchie visuelle ≠ hiérarchie d'autorisation. Un rôle "manager" peut être fils de "director" sans que director ait GRANT sur manager.

**Si garde-fou souhaité** : Utiliser une **permission explicite** (ex: `rbac.assign_role_max_level_10`) plutôt qu'un niveau numérique implicite.

### 6. Modifications de schéma nécessaires

**Aucune** pour Option A. La colonne existe, reste métadonnée.

Si Option B choisie (non recommandé) : logique dans `assign_user_role` RPC.

### 7. Compatibilité migrations existantes

**100% compatible** : valeurs actuelles (tous à 0) ne bloquent rien si non utilisées.

---

## Synthèse

| Décision | Options analysées | Impact principal | Recommandation OpenCode | Décision utilisateur nécessaire |
|---|---|---|---|---|
| **1. role scope** | A: rôle bénéficiaire / B: périmètre / D: interdire | Sémantique délégation, `scope_includes`, UI | **A** (aligné `scope_includes` existant) | Confirmer Option A ou choisir B/D |
| **2. self scope** | A: autoriser / B: interdire | Cohérence délégation, simplicité | **B** (interdire — self = oxymore délégation) | Confirmer interdiction |
| **3. manage permissions** | A: nouvelles perms / B: réutiliser / C: hybride | Granularité RBAC vs métier, délégation config | **C/Hybride** : perms `rbac.*` catégorie 'rbac' | Valider création 4 permissions `rbac.*` |
| **4. hierarchy_level** | A: structurel pur / B: garde-fou / C: racine=0 | Respect modèle (structure≠autorisation) | **A** (purement structurel) | Confirmer non-usage autorisation |

---

**Prochaine étape** : Vos décisions sur ces 4 points → mise à jour `P1_3_4_B_S2_A_SPEC.md` si besoin → **GO pour S2-B**.