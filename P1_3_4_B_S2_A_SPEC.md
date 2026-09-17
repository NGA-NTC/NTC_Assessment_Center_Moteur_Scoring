# P1.3.4-B-S2-A

## 1. Matrice des mutations

| Mutation | Acteur autorisé | Capability | Permission | Scope | Anti-escalade |
|---|---|---|---|---|---|
| A. Attribuer permission/capacité à un rôle | Rôle avec GRANT sur `role_permissions` + DELEGATE si délégation | GRANT | `role_permissions.manage` (nouvelle) | Scope de l'acteur doit inclure scope cible | Vérifier que capability attribuée ⊆ capabilities détenues par l'acteur sur ce scope ; interdire auto-attribution ; vérifier role_assignability si rôle système |
| B. Retirer permission/capacité d'un rôle | Rôle avec GRANT sur `role_permissions` | GRANT | `role_permissions.manage` | Scope de l'acteur doit inclure scope cible | Vérifier que l'acteur a GRANT sur ce scope ; interdire retrait de sa propre dernière capacité GRANT (sauf super_admin) |
| C. Créer role_delegation | Rôle avec DELEGATE sur la permission ciblée | DELEGATE | permission ciblée | Scope délégué ⊆ scope détenu par délégateur | Vérifier DELEGATE effective (pas GRANT) ; scope demandé ≤ scope détenu ; interdire auto-délégation (delegator ≠ target) ; vérifier expiration/révocation délégateur ; chaîne max profondeur 5 |
| D. Révoquer role_delegation | Délégateur original OU rôle avec MANAGE sur `role_delegations` | MANAGE / DELEGATE | `role_delegations.manage` (nouvelle) | Scope inclut la délégation | Seul délégateur ou MANAGE effectif ; vérifier que délégation n'est pas déjà révoquée/expirée |
| E. Créer user_delegation | Utilisateur avec DELEGATE sur la permission ciblée | DELEGATE | permission ciblée | Scope délégué ⊆ scope détenu par délégateur | Vérifier DELEGATE effective (role_permissions.can_delegate uniquement) ; scope demandé ≤ scope détenu ; interdire auto-délégation ; bénéficiaire ne reçoit PAS DELEGATE |
| F. Révoquer user_delegation | Donneur original OU rôle avec MANAGE sur `user_delegations` | MANAGE / DELEGATE | `user_delegations.manage` (nouvelle) | Scope inclut la délégation | Seul donneur ou MANAGE effectif ; vérifier expiration/révocation |
| G. Attribuer rôle (user_roles) | Rôle avec GRANT sur `user_roles` + role_assignability configurée | GRANT | `users.change_role` + role_assignability | Scope inclut utilisateur cible | 1. Autorité effective GRANT 2. role_assignability existe 3. Scope inclut cible 4. Rôle cible is_assignable=true 5. Anti-escalade : hierarchy_level cible ≤ hierarchy_level acteur (si défini) 6. Interdire auto-attribution (sauf super_admin bootstrap) |

---

## 2. Fonctions SQL proposées

### 2.1 `grant_role_permission`
```sql
create or replace function public.grant_role_permission(
    p_target_role_id text,
    p_permission_id text,
    p_capabilities jsonb,  -- {"use": true, "manage": false, "grant": true, "delegate": false}
    p_scope_type text default 'global',
    p_scope_value text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
-- Vérifier auth.uid() a GRANT effective sur p_permission_id dans p_scope
-- Vérifier scope_includes(scope_acteur, scope_cible)
-- Vérifier p_capabilities ⊆ capabilities_acteur
-- Anti-auto-attribution : target_role_id ∉ rôles_acteur
-- Insérer/mettre à jour role_permissions
$$;
```
- **Retour** : void
- **SECURITY DEFINER** : oui
- **search_path** : public
- **auth.uid()** : vérifié au début
- **Autorisation** : `has_effective_capability(auth.uid(), 'GRANT', p_permission_id, p_scope_type, p_scope_value)`
- **Validation** : capabilities JSON valides, scope valide, rôle cible existe, pas auto-attribution
- **Erreurs** : `insufficient_authority`, `invalid_scope`, `self_grant_forbidden`, `capability_escalation`
- **Effets** : upsert dans `role_permissions`
- **EXECUTE GRANT** : `authenticated` (RLS gère le reste)

### 2.2 `revoke_role_permission`
```sql
create or replace function public.revoke_role_permission(
    p_target_role_id text,
    p_permission_id text,
    p_capabilities text[],  -- ['USE', 'GRANT'] - capabilities à retirer
    p_scope_type text default 'global',
    p_scope_value text default null
) returns void
```
- **Autorisation** : GRANT effective sur permission + scope
- **Anti-escalade** : ne peut pas retirer sa propre dernière capacité GRANT (sauf super_admin)

### 2.3 `create_role_delegation`
```sql
create or replace function public.create_role_delegation(
    p_target_role_id text,
    p_permission_id text,
    p_delegation_type text,  -- 'use' | 'manage' | 'grant'
    p_scope_type text default 'global',
    p_scope_value text default null,
    p_expires_at timestamptz default null
) returns uuid
```
- **Autorisation** : `has_effective_capability(auth.uid(), 'DELEGATE', p_permission_id, p_scope_type, p_scope_value)`
- **Note** : DELEGATE ne vient JAMAIS d'une délégation reçue
- **Anti-escalade** : 
  - `scope_includes(scope_déléguateur, p_scope)` 
  - `delegator_role_id` ∈ rôles_acteur
  - `delegator_role_id != target_role_id`
  - chaîne < 5 (vérifier via `get_effective_authority`)
  - expiration ≤ expiration_acteur si définie

### 2.4 `revoke_role_delegation`
```sql
create or replace function public.revoke_role_delegation(
    p_delegation_id uuid
) returns void
```
- **Autorisation** : délégateur original (`created_by = auth.uid()`) OU `has_effective_capability(auth.uid(), 'MANAGE', 'role_delegations.manage', ...)`
- **Vérification** : délégation existe, non révoquée, non expirée

### 2.5 `create_user_delegation`
```sql
create or replace function public.create_user_delegation(
    p_grantee_user_id uuid,
    p_permission_id text,
    p_delegation_type text,  -- 'use' | 'manage' | 'grant'
    p_scope_type text default 'global',
    p_scope_value text default null,
    p_expires_at timestamptz default null,
    p_reason text
) returns uuid
```
- **Autorisation** : `has_effective_capability(auth.uid(), 'DELEGATE', p_permission_id, p_scope_type, p_scope_value)`
- **Critique** : bénéficiaire ne reçoit PAS DELEGATE
- **Anti-escalade** : scope_includes(scope_donneur, scope_demandé), donneur ≠ bénéficiaire

### 2.6 `revoke_user_delegation`
```sql
create or replace function public.revoke_user_delegation(
    p_delegation_id uuid
) returns void
```
- **Autorisation** : donneur original OU MANAGE effectif sur `user_delegations.manage`

### 2.7 `assign_user_role`
```sql
create or replace function public.assign_user_role(
    p_target_user_id uuid,
    p_role_id text,
    p_expires_at timestamptz default null
) returns void
```
- **Autorisation** : GRANT effective sur `users.change_role` + scope inclut cible
- **Vérifications obligatoires** (TOUTES requises) :
  1. `has_effective_capability(auth.uid(), 'GRANT', 'users.change_role', scope_cible)`
  2. `exists(select 1 from role_assignability where assigner_role_id = any(acteurs_roles) and assignable_role_id = p_role_id)`
  3. `select is_assignable from roles where id = p_role_id` = true
  4. `scope_includes(scope_acteur, scope_cible)` où scope_cible = ('user', p_target_user_id)
  5. Anti-escalade : `hierarchy_level` cible ≤ `hierarchy_level` max acteur (si > 0)
  6. Interdire auto-attribution sauf super_admin bootstrap
- **Effets** : insert dans `user_roles` avec `assigned_by = auth.uid()`

### 2.8 `revoke_user_role`
```sql
create or replace function public.revoke_user_role(
    p_target_user_id uuid,
    p_role_id text
) returns void
```
- **Autorisation** : GRANT effective sur `users.change_role` + scope inclut cible
- **Anti-escalade** : ne peut pas révoquer son propre dernier rôle admin (sauf super_admin)

### 2.9 `set_role_assignability`
```sql
create or replace function public.set_role_assignability(
    p_assigner_role_id text,
    p_assignable_role_id text,
    p_allow boolean
) returns void
```
- **Autorisation** : SUPER_ADMIN uniquement (configuration structurelle)
- **Rationale** : role_assignability = configuration, pas délégation dynamique

---

## 3. Matrice USE / MANAGE / GRANT / DELEGATE

| Capacité | Source | Peut être déléguée | Signification |
|---|---|---|---|
| **USE** | `role_permissions.can_use`, délégation reçue | OUI (via DELEGATE) | Lire/exécuter la permission |
| **MANAGE** | `role_permissions.can_manage`, délégation reçue | OUI (via DELEGATE) | Créer/modifier/supprimer les ressources de la permission |
| **GRANT** | `role_permissions.can_grant`, délégation reçue | OUI (via DELEGATE) | Attribuer/retirer la permission à d'autres rôles/utilisateurs |
| **DELEGATE** | **UNIQUEMENT** `role_permissions.can_delegate` (jamais délégation) | **NON** | Créer des délégations (role_delegations, user_delegations) |

### Règles d'indépendance stricte :
- `USE ⊄ MANAGE ⊄ GRANT ⊄ DELEGATE` (aucune inclusion)
- Une délégation de type `grant` donne GRANT, **pas** DELEGATE
- Une délégation de type `manage` donne MANAGE, **pas** GRANT ni DELEGATE
- DELEGATE est une capacité **méta** : elle s'applique à la création de délégations sur une permission donnée

### Implications pour les mutations :
| Mutation | Capability requise | Note |
|---|---|---|
| Modifier `role_permissions` (A, B) | GRANT | Sur la permission `role_permissions.manage` (nouvelle) |
| Créer `role_delegations` (C) | DELEGATE | Sur la permission **ciblée** par la délégation |
| Créer `user_delegations` (E) | DELEGATE | Sur la permission **ciblée** par la délégation |
| Attribuer rôle (G) | GRANT | Sur `users.change_role` + role_assignability config |

---

## 4. Règles anti-escalade

### 4.1 Auto-attribution interdite
- Aucune mutation ne permet à l'acteur de s'attribuer des droits à lui-même
- Exception : `bootstrap_super_admin` (procédure unique, hors moteur)

### 4.2 Auto-délégation interdite
- `role_delegations` : `delegator_role_id != target_role_id` (contrainte CHECK existante)
- `user_delegations` : `granter_user_id != grantee_user_id` (contrainte CHECK existante)
- `assign_user_role` : `target_user_id != auth.uid()` (sauf super_admin)

### 4.3 Attribution d'autorité supérieure interdite
- Capabilities attribuées ⊆ capabilities détenues par l'acteur sur ce scope
- `hierarchy_level` cible ≤ `hierarchy_level` max de l'acteur (si les deux > 0)
- Rôle cible `is_assignable = true` requis

### 4.4 Élargissement de scope interdit
- `scope_includes(scope_acteur, scope_demandé)` doit être TRUE
- Scope délégué ⊆ scope détenu
- `global` > `role` > `user` > `self` (hiérarchie figée dans `scope_includes`)

### 4.5 Redélégation sans DELEGATE interdite
- Recevoir une délégation (use/manage/grant) ne donne **jamais** DELEGATE
- `has_effective_capability(..., 'DELEGATE', ...)` ne regarde QUE `role_permissions.can_delegate`
- Les CTE récursives dans `get_effective_authority` ne propagent PAS DELEGATE

### 4.6 GRANT ≠ DELEGATE
- GRANT permet d'attribuer des permissions/rôles
- DELEGATE permet de créer des délégations
- Ce sont deux colonnes/flags indépendants dans `role_permissions`

### 4.7 Contournement via parent_id / hierarchy_level / is_assignable
- Ces champs sont **structurels uniquement**
- `parent_id` : info hiérarchie, pas autorité
- `hierarchy_level` : utilisé seulement pour anti-escalade (niveau max attribuable)
- `is_assignable` : flag configuration, pas permission
- **Aucun** de ces champs ne donne droit à USE/MANAGE/GRANT/DELEGATE

### 4.8 Contournement via role_assignability
- `role_assignability` = configuration statique (qui *peut* assigner quoi)
- Nécessaire mais **insuffisant** pour autoriser une attribution
- Doit être combiné avec : autorité effective GRANT + scope + anti-escalade

### 4.9 Chaînes de délégation
- Profondeur max : 5 (codé en dur dans `get_effective_authority`)
- Anti-cycle : `not delegator_role_id = any(path)`
- Une chaîne ne peut pas élargir le scope à chaque maillon
- `scope_includes` vérifié à chaque étape de la chaîne

---

## 5. Règles de scopes

### 5.1 Hiérarchie validée (scope_includes)
```
global ⊃ role ⊃ user ⊃ self
```

### 5.2 Sémantique par type

| Scope Type | Scope Value | Signification |
|---|---|---|
| `global` | NULL | Toute l'application |
| `role` | role_id | Tous utilisateurs ayant ce rôle (actif) |
| `user` | user_id | Un utilisateur spécifique |
| `self` | NULL | L'acteur lui-même uniquement |

### 5.3 Ambiguïtés identifiées

#### AMBIGUÏTÉ 1 : `scope_value` pour `role_delegations`
- `delegator_role_id` a une délégation scope `role` + `scope_value = 'admin'`
- Cela signifie-t-il : "délégation valable pour tous les users ayant rôle admin" ?
- Ou : "délégation valable seulement dans le contexte du rôle admin" ?
- **Décision nécessaire** : Clarifier si scope_value référence le rôle du *bénéficiaire* ou le rôle du *délégateur*.

#### AMBIGUÏTÉ 2 : `scope_value` pour `user_delegations` avec `scope_type = 'role'`
- Table `user_delegations` permet `scope_type = 'role'` avec `scope_value = role_id`
- Mais `user_delegations` lie user→user, pas rôle→rôle
- **Décision nécessaire** : Soit interdire `scope_type='role'` dans user_delegations, soit définir précisément : "délégation valable seulement quand bénéficiaire agit dans ce rôle"

#### AMBIGUÏTÉ 3 : Scope `self` dans délégations
- `scope_includes` retourne FALSE pour `self` incluant quoi que ce soit
- Une délégation `scope_type='self'` n'a de sens que si grantee = granter (interdit par CHECK)
- **Décision nécessaire** : Soit interdire `scope_type='self'` dans tables délégations, soit documenter usage précis.

#### AMBIGUÏTÉ 4 : Scope `role` dans `role_delegations` - quel rôle ?
- `delegator_role_id` délègue à `target_role_id` avec `scope_type='role'`, `scope_value='manager'`
- Est-ce que `scope_value` = rôle du bénéficiaire effectif (user ayant rôle manager) ?
- Ou `scope_value` = scope d'application de la délégation (ex: "dans le périmètre du rôle manager") ?
- **Décision nécessaire** : Définir sémantique exacte avant S2-B.

### 5.4 Règle générale mutations
- Scope demandé ⊆ Scope détenu par l'acteur (via `scope_includes`)
- Pour attribution rôle : scope acteur doit inclure `('user', target_user_id)`

---

## 6. Expiration / Révocation

### 6.1 Tables concernées
| Table | Colonnes |
|---|---|
| `user_roles` | `expires_at`, `revoked_at`, `revoked_by` |
| `role_delegations` | `expires_at`, `revoked_at`, `revoked_by` |
| `user_delegations` | `expires_at`, `revoked_at`, `revoked_by` |

### 6.2 Règles pour mutations
1. **Autorité expirée/révoquée = aucune autorité**
   - Toute vérification `has_effective_capability` filtre déjà `revoked_at is null` et `expires_at > now()`
   - Les mutations DOIVENT réutiliser cette logique

2. **Création de délégation**
   - `expires_at` déléguée ≤ `expires_at` délégateur (si les deux définis)
   - Si délégateur n'a pas d'expiration, déléguée peut en avoir une

3. **Révocation en cascade**
   - Révocation d'un `user_role` → invalide délégations reçues via ce rôle
   - Révocation d'une `role_delegation` → invalide chaîne descendante
   - Révocation d'une `user_delegation` → effet immédiat
   - **À implémenter** : trigger ou contrôle applicatif dans fonctions de révocation

4. **Vérification à l'exécution**
   - Chaque fonction de mutation doit vérifier `revoked_at` et `expires_at` de L'AUTORITÉ SOURCE
   - Pas seulement de l'objet créé/modifié

---

## 7. RLS / SECURITY DEFINER / EXECUTE

### 7.1 Philosophie
- **RLS** : Contrôle d'accès aux DONNÉES (lecture/écriture directe sur tables)
- **RPC SECURITY DEFINER** : Logique métier + vérifications d'autorisation complexes
- **Combinaison** : Tables sensibles = RLS restrictif + RPC pour mutations autorisées

### 7.2 Matrice protection

| Table | RLS SELECT | RLS WRITE | RPC Mutation |
|---|---|---|---|
| `role_permissions` | authenticated (lecture) | SUPER_ADMIN only | `grant_role_permission`, `revoke_role_permission` |
| `role_delegations` | SUPER_ADMIN only | SUPER_ADMIN only | `create_role_delegation`, `revoke_role_delegation` |
| `user_delegations` | SUPER_ADMIN + parties | SUPER_ADMIN only | `create_user_delegation`, `revoke_user_delegation` |
| `user_roles` | own + admin/super_admin | admin/super_admin + permission | `assign_user_role`, `revoke_user_role` |
| `role_assignability` | SUPER_ADMIN only | SUPER_ADMIN only | `set_role_assignability` |

### 7.3 Principes RPC
- **TOUTES** les fonctions de mutation = `SECURITY DEFINER` + `set search_path = public`
- **AUCUNE** policy `USING(true)` sur tables sensibles
- Vérification `auth.uid()` au début de chaque fonction
- Vérification autorité effective via `has_effective_capability`
- Lever exception explicite si refus (`insufficient_authority`, `scope_violation`, etc.)
- `GRANT EXECUTE` à `authenticated` (RLS + logique RPC font le filtrage)

### 7.4 Tables nécessitant nouvelles permissions
Pour supporter GRANT/MANAGE sur les tables de configuration RBAC, ajouter dans `permissions` :
```sql
('role_permissions.manage', 'Gérer permissions rôles', 'Attribuer/retirer capacités aux rôles', 'rbac'),
('role_delegations.manage', 'Gérer délégations rôles', 'Créer/révoquer délégations par rôle', 'rbac'),
('user_delegations.manage', 'Gérer délégations users', 'Créer/révoquer délégations individuelles', 'rbac'),
```
Puis dans `role_permissions` pour super_admin (et éventuellement admin selon besoin).

---

## 8. Audit futur

### 8.1 Événements à journaliser (ultérieurement, table `audit_log`)

| Catégorie | Événements |
|---|---|
| **Permissions rôles** | `role_permission.granted`, `role_permission.revoked`, `role_permission.modified` |
| **Délégations rôles** | `role_delegation.created`, `role_delegation.revoked`, `role_delegation.expired` |
| **Délégations users** | `user_delegation.created`, `user_delegation.revoked`, `user_delegation.expired` |
| **Attribution rôles** | `user_role.assigned`, `user_role.revoked`, `user_role.expired` |
| **Configuration** | `role_assignability.set`, `role.hierarchy_changed` |
| **Sécurité** | `escalation_attempt`, `self_grant_attempt`, `scope_violation` |

### 8.2 Champs minimums par entrée
- `event_type` (texte, enum)
- `actor_user_id` (uuid, auth.uid())
- `target_user_id` / `target_role_id` (nullable)
- `permission_id` (nullable)
- `capability` (USE/MANAGE/GRANT/DELEGATE)
- `scope_type`, `scope_value`
- `details` (jsonb : valeurs avant/après, chaîne délégation, etc.)
- `created_at` (timestamptz default now())
- `ip_address`, `user_agent` (optionnel, via headers RPC)

---

## 9. Ambiguïtés ou décisions nécessaires

| # | Sujet | Description | Impact S2-B |
|---|---|---|---|
| 1 | Sémantique `scope_type='role'` dans `role_delegations` | `scope_value` référence-t-il le rôle du bénéficiaire ou le périmètre d'application ? | Bloquant pour C/D |
| 2 | `scope_type='role'` dans `user_delegations` | Table user→user mais scope role autorisé. Sens ? | Bloquant pour E/F |
| 3 | `scope_type='self'` dans délégations | Incompatible avec CHECK no-self-delegation. Interdire ? | Bloquant pour C/E |
| 4 | Permission `role_permissions.manage` | Existe-t-elle ? Faut-il la créer ? | Requis pour A/B |
| 5 | Permissions `role_delegations.manage`, `user_delegations.manage` | Existent-elles ? Faut-il les créer ? | Requis pour D/F |
| 6 | `hierarchy_level` : 0 = pas de limite ? | Si acteur level=0, peut-il attribuer level>0 ? | Requis pour G |
| 7 | Révocation en cascade | Trigger DB ou logique dans RPC ? | Architectural |
| 8 | Super Admin : bypass total ou scope global ? | `has_role(auth.uid(), 'super_admin')` donne-t-il tout ou scope global seulement ? | Architectural |

---

## 10. Ordre d'implémentation S2-B

### Phase 1 : Fondations (permissions + RLS)
1. Créer permissions manquantes : `role_permissions.manage`, `role_delegations.manage`, `user_delegations.manage`
2. Attribuer à `super_admin` (et `admin` si pertinent) via `role_permissions`
3. Mettre à jour RLS `role_permissions` : lecture publique, écriture via RPC seulement
4. Ajouter CHECK `role_permissions` : pas de capacité sans USE de base (optionnel)

### Phase 2 : Mutations role_permissions (A, B)
5. `grant_role_permission` + `revoke_role_permission`
6. Tests : GRANT requis, scope respecté, anti-escalade capabilities

### Phase 3 : Mutations role_delegations (C, D)
7. `create_role_delegation` + `revoke_role_delegation`
8. Tests : DELEGATE requis (pas GRANT), scope ⊆, chaîne max 5, anti-cycle

### Phase 4 : Mutations user_delegations (E, F)
9. `create_user_delegation` + `revoke_user_delegation`
10. Tests : DELEGATE requis, bénéficiaire sans DELEGATE, scope ⊆

### Phase 5 : Mutations user_roles (G)
11. `assign_user_role` + `revoke_user_role`
12. Tests : GRANT + role_assignability + is_assignable + scope + hierarchy_level + anti-auto

### Phase 6 : Configuration
13. `set_role_assignability` (SUPER_ADMIN only)
14. Nettoyage/validation cohérence

### Phase 7 : Intégration + Tests complets
15. Scénarios bout-en-bout : délégation → attribution → révocation
16. Tests escalade : tentatives interdites bloquées
17. Tests expiration/révocation cascade

---

**P1.3.4-B-S2-A = COMPLETE**

### GO / NO-GO pour P1.3.4-B-S2-B

**GO** sous réserve de résolution des **4 ambiguïtés bloquantes** (section 9, #1-4) avant démarrage S2-B.

Décisions requises :
1. Sémantique `scope_type='role'` dans `role_delegations` et `user_delegations`
2. Interdiction `scope_type='self'` dans tables délégations
3. Création permissions `*.manage` manquantes
4. Règle `hierarchy_level` = 0 (pas de limite ou niveau racine ?)