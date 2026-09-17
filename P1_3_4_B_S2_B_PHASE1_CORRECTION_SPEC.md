# P1.3.4-B-S2-B-PHASE1-CORRECTION-SPEC

## 1. PROBLÈME ACTUEL

### Résumé de l'audit (NO-GO)

| # | Problème | Gravité |
|---|---|---|
| 1 | **GRANT inutilisé** — MANAGE sur `rbac.role_permissions` autorise toutes mutations ; GRANT jamais vérifié | 🔴 Critique |
| 2 | **Auto-GRANT possible** — Acteur avec MANAGE peut s'attribuer GRANT/DELEGATE via `grant_role_permission` sur son propre rôle | 🔴 Critique |
| 3 | **`get_role_permission` sans contrôle** — Tout `authenticated` lit la matrice RBAC complète sans vérification d'autorité | 🔴 Critique |
| 4 | **Auto-révocation via délégation bypassée** — Protection ne vérifie que `user_roles` direct, pas les rôles acquis par délégation | 🔴 Critique |

### Cause racine
La RPC `grant_role_permission` utilise **une seule capability (MANAGE)** comme "porte d'entrée unique" pour toutes opérations d'écriture, ignorant GRANT/DELEGATE/USE. Le modèle S1/S2-A prévoit 4 capabilities indépendantes — chacune doit avoir un rôle distinct.

---

## 2. MATRICE USE / MANAGE / GRANT / DELEGATE SUR `rbac.role_permissions`

### Définition des opérations

| Code | Opération | Description |
|---|---|---|
| **A** | **Consulter** | Lire les capabilities d'un rôle pour une permission (ex: `get_role_permission`) |
| **B** | **Ajouter** | Créer une nouvelle ligne `role_permissions` (rôle n'avait pas cette permission) |
| **C** | **Modifier** | Changer les capabilities d'une permission existante (ex: passer USE→true, GRANT→true) |
| **D** | **Supprimer** | Retirer entièrement une permission d'un rôle (toutes capabilities → false) |
| **E** | **Accorder** | Donner une capability spécifique à un rôle (sous-ensemble de B/C) |
| **F** | **Retirer** | Enlever une capability spécifique d'un rôle (sous-ensemble de C/D) |
| **G** | **Modifier autorité tierce** | Changer l'autorité d'un rôle qui n'est pas le sien (cas général) |
| **H** | **Préparer délégation** | Configurer les capacités nécessaires pour qu'une délégation future soit possible |

### Matrice d'autorisation (RÈGLE CIBLE)

| Opération | Capability requise sur `rbac.role_permissions` | Capability requise sur permission CIBLE (`p_permission_id`) | Note |
|---|---|---|---|
| **A. Consulter** | **USE** | USE (sur permission cible) | Lecture seule, scope respecté |
| **B. Ajouter** | **GRANT** | GRANT (sur permission cible) | Créer nouvelle relation rôle↔permission |
| **C. Modifier** | **GRANT** | GRANT (sur permission cible) | Changer capabilities existantes |
| **D. Supprimer** | **GRANT** | GRANT (sur permission cible) | Retirer relation complète |
| **E. Accorder (cap spécifique)** | **GRANT** | GRANT + capability demandée détenue | Sous-opération de B/C |
| **F. Retirer (cap spécifique)** | **GRANT** | GRANT (sur permission cible) | Sous-opération de C/D |
| **G. Modifier autorité tierce** | **GRANT** | GRANT + capability demandée détenue | Cas général, anti-escalade |
| **H. Préparer délégation** | **DELEGATE** | DELEGATE (sur permission cible) | Créer les caps pour délégation future |

### Règles fondamentales

1. **GRANT = "Attribuer à autrui"** — Toute opération qui *change l'autorité d'un autre rôle* nécessite GRANT sur `rbac.role_permissions` ET sur la permission cible.
2. **MANAGE = "Configurer la ressource"** — MANAGE sur `rbac.role_permissions` permet de *gérer la table elle-même* (schéma, index, contraintes, audit), **pas** d'attribuer des permissions aux rôles.
3. **DELEGATE = "Créer délégations"** — Nécessaire pour configurer les capabilities qui permettront ensuite des délégations (ex: donner DELEGATE sur `users.change_role` pour que le rôle puisse déléguer cette permission).
4. **USE = "Lire/Exécuter"** — Lecture de la configuration, exécution d'actions métier (pas config RBAC).

### Tableau de non-implication (RAPPORT AU MODÈLE)

```
USE ⇏ MANAGE
USE ⇏ GRANT
USE ⇏ DELEGATE
MANAGE ⇏ USE
MANAGE ⇏ GRANT
MANAGE ⇏ DELEGATE
GRANT ⇏ USE
GRANT ⇏ MANAGE
GRANT ⇏ DELEGATE
DELEGATE ⇏ USE
DELEGATE ⇏ MANAGE
DELEGATE ⇏ GRANT
```

**Aucune flèche n'existe.** Chaque capability est indépendante.

---

## 3. RÈGLES EXACTES DE GRANT

### Principe : "On ne peut pas accorder ce qu'on n'a pas"

Pour **chaque capability** demandée dans `p_capabilities` (grant_role_permission) ou révoquée (revoke_role_permission) :

```
SI acteur veut accorder capability X sur permission P dans scope S
ALORS acteur doit posséder capability X sur permission P dans scope S' tel que scope_includes(S', S)
```

### Application par capability sur permission CIBLE

| Capability demandée sur permission CIBLE | Capability requise sur `rbac.role_permissions` | Capability requise sur permission CIBLE |
|---|---|---|
| **USE** | GRANT | USE |
| **MANAGE** | GRANT | MANAGE |
| **GRANT** | GRANT | GRANT |
| **DELEGATE** | GRANT + DELEGATE* | DELEGATE |

*DELEGATE sur `rbac.role_permissions` requis pour accorder DELEGATE (métadélégation).

### Exemple obligatoire analysé

> **Acteur a : MANAGE sur `rbac.role_permissions`, mais PAS GRANT.**
>
> **Question :** Peut-il s'accorder GRANT ou DELEGATE ?

**RÉPONSE : NON.**

- Pour accorder GRANT sur n'importe quelle permission → il faut GRANT sur `rbac.role_permissions` (manquant)
- Pour accorder DELEGATE → il faut GRANT + DELEGATE sur `rbac.role_permissions` (les deux manquants)
- MANAGE seul ne permet **aucune** attribution de capabilities à d'autres rôles

**C'est la correction centrale** : MANAGE ≠ GRANT.

---

## 4. RÈGLES ANTI-ESCALADE

### 4.1 Auto-élévation interdite

| Type | Règle | Exception |
|---|---|---|
| **auto-USE** | Interdit de s'ajouter USE sur permission où on n'en a pas | Super Admin (bootstrap) |
| **auto-MANAGE** | Interdit de s'ajouter MANAGE sur permission où on n'en a pas | Super Admin |
| **auto-GRANT** | **INTERDIT ABSOLU** — aucun acteur ne peut s'accorder GRANT | Super Admin (bootstrap unique) |
| **auto-DELEGATE** | **INTERDIT ABSOLU** — aucun acteur ne peut s'accorder DELEGATE | Super Admin (bootstrap unique) |

### 4.2 Distinction des cibles

| Cible | Règle de détection | Protection |
|---|---|---|
| **A. Son propre rôle direct** | `p_target_role_id` ∈ `user_roles.role_id` (actif) | Bloquer auto-GRANT/auto-DELEGATE |
| **B. Autre rôle** | `p_target_role_id` ∉ rôles_acteur | Vérifier GRANT + capability demandée ≤ détenue |
| **C. Rôle acquis par délégation** | `has_effective_capability(auth.uid(), 'USE', 'role', scope)` → TRUE mais pas dans `user_roles` | **Même protection que A** (autorité effective) |
| **D. Son autorité effective** | Toute modification qui augmente l'autorité effective de l'acteur | Bloquer si résultat = escalade |

### 4.3 Protection contre escalade indirecte

**Scénario interdiction :**
```
Acteur (MANAGE seulement)
  → grant_role_permission(son_rôle, 'rbac.role_permissions', {"grant": true})
  → son_rôle a maintenant GRANT sur rbac.role_permissions
  → Acteur a maintenant GRANT effectif (via son rôle)
  → ESCALADE
```

**Règle :** Dans `grant_role_permission`, si `p_target_role_id` est un rôle que l'acteur possède **effectivement** (direct ou via délégation), interdire d'ajouter GRANT ou DELEGATE sur `rbac.role_permissions` et sur `rbac.role_delegations`.

### 4.4 Implémentation technique (réutilisation S1)

```sql
-- Détecter si acteur a le rôle cible EFFECTIVEMENT
SELECT public.has_effective_capability(
    auth.uid(), 'USE', 'role', 'role', p_target_role_id
) INTO v_actor_has_target_role_effective;

-- Ou via get_effective_authority pour lister tous les rôles effectifs
```

---

## 5. RÈGLES GET_ROLE_PERMISSION

### Politique de consultation

| Profil acteur | Capability sur `rbac.role_permissions` | Scope | Peut consulter |
|---|---|---|---|
| **A. Sans permission RBAC** | — | — | **RIEN** (erreur PERMISSION_INSUFFISANTE) |
| **B. USE seulement** | USE | global | **Tous rôles** (lecture globale config) |
| **B. USE seulement** | USE | role:X | Rôles dans scope `role:X` (rôle X + descendants si hiérarchie) |
| **B. USE seulement** | USE | user:U | Son propre rôle uniquement |
| **C. MANAGE** | MANAGE | global | Tous rôles (comme USE + peut voir pour décision config) |
| **D. GRANT** | GRANT | global | Tous rôles (nécessaire pour décider quoi accorder) |
| **E. DELEGATE** | DELEGATE | global | Tous rôles (nécessaire pour décider délégations) |
| **F. Scope global** | USE/MANAGE/GRANT/DELEGATE | global | Tous rôles |
| **G. Scope role:X** | USE/MANAGE/GRANT/DELEGATE | role:X | Rôles où scope_includes(role:X, scope_rôle_cible) |
| **H. Scope user:U** | USE/MANAGE/GRANT/DELEGATE | user:U | Rôles de l'utilisateur U seulement |
| **I. Rôle hors scope** | N'importe quelle | N'importe quel | **REFUS** (erreur SCOPE_INSUFFISANT) |

### Règle unifiée

```sql
-- Dans get_role_permission
v_actor_can_read := public.has_effective_capability(
    auth.uid(), 'USE', 'rbac.role_permissions', p_scope_type, p_scope_value
);
-- OU plus permissif : USE OU MANAGE OU GRANT OU DELEGATE sur rbac.role_permissions
v_actor_can_read := public.has_effective_capability(auth.uid(), 'USE', 'rbac.role_permissions', ...)
                  OR public.has_effective_capability(auth.uid(), 'MANAGE', 'rbac.role_permissions', ...)
                  OR public.has_effective_capability(auth.uid(), 'GRANT', 'rbac.role_permissions', ...)
                  OR public.has_effective_capability(auth.uid(), 'DELEGATE', 'rbac.role_permissions', ...);
```

### Anti-énumération

- Pas de `LIST` ou `GET_ALL` — seulement lookup par `(role_id, permission_id)`
- L'acteur doit connaître le `role_id` et `permission_id` qu'il veut consulter
- Pas de fuite d'information sur l'existence de rôles/permissions hors scope

---

## 6. AUTORITÉ EFFECTIVE — RÈGLES DE VÉRIFICATION

### Principe : Une seule source de vérité

Toutes les vérifications d'autorisation passent par **`has_effective_capability()`** (S1 validé).

### Ce que `has_effective_capability()` couvre déjà ✅

| Source d'autorité | Couvert par S1 |
|---|---|
| Rôles directs (`user_roles` actif, non expiré, non révoqué) | ✅ |
| `role_permissions.can_use/manage/grant/delegate` | ✅ |
| `role_delegations` (chaîne récursive, anti-cycle, profondeur ≤5) | ✅ |
| `user_delegations` (priorité haute) | ✅ |
| Expiration (`expires_at`) | ✅ |
| Révocation (`revoked_at`) | ✅ |
| Scope (`scope_includes`) | ✅ |

### Corrections requises dans Phase 1

| RPC | Remplacer | Par |
|---|---|---|
| `revoke_role_permission` ligne 298-304 | `EXISTS user_roles WHERE user_id=actor AND role_id=target` | `has_effective_capability(actor, 'USE', 'role', 'role', target_role_id)` |
| `grant_role_permission` anti-auto-GRANT | Pas de check | `has_effective_capability(actor, 'USE', 'role', 'role', target_role_id)` → si TRUE, bloquer GRANT/DELEGATE sur `rbac.*` |

### Pas de réimplémentation

- **Interdit** : `SELECT FROM user_roles JOIN role_delegations...` dans les RPC
- **Obligatoire** : Appeler `has_effective_capability()` / `get_effective_authority()`

---

## 7. SUPER_ADMIN — COMPORTEMENT DOCUMENTÉ

### Comportement actuel (audit ligne 306-307)
```sql
SELECT public.has_role(v_actor_uid, 'super_admin') INTO v_is_super_admin;
IF v_is_self_revocation AND NOT v_is_super_admin THEN ...
```

### Problème
`has_role(auth.uid(), 'super_admin')` = **bypass générique** basé sur nom de rôle, contournant le modèle capability.

### Règle corrigée

**Super Admin n'a pas de "pouvoir magique".** Il a :
- Les 4 capabilities (USE, MANAGE, GRANT, DELEGATE) sur **toutes** les permissions `rbac.*` via `role_permissions`
- Scope **global** sur ces permissions
- Cela lui permet **toutes opérations** via les règles normales (GRANT pour attribuer, etc.)

### Exception unique documentée

**Seule exception** : `bootstrap_super_admin()` (fonction existante, migration 20260912) — création du premier super_admin hors système RBAC.

**Dans les RPC Phase 1 :**
- **AUCUN** `IF has_role(..., 'super_admin') THEN ALLOW`
- Les règles normales s'appliquent : Super Admin a GRANT global sur `rbac.role_permissions` → peut tout faire
- Si Super Admin se révoque ses propres caps → il perd l'accès (comportement normal, récupérable via bootstrap SQL direct)

### Suppression du bypass

Dans `revoke_role_permission` : **supprimer** les lignes 306-307 et 329-338 (le bloc `IF v_is_self_revocation AND NOT v_is_super_admin`).

La protection anti-auto-révocation s'applique à **tous**, y compris Super Admin.

---

## 8. RÈGLES DE RÉVOCATION

### Qui peut révoquer ?

| Opération | Capability requise sur `rbac.role_permissions` | Capability requise sur permission CIBLE |
|---|---|---|
| Retirer capability spécifique (USE/MANAGE/GRANT/DELEGATE) | **GRANT** | GRANT |
| Supprimer relation complète (toutes caps → false) | **GRANT** | GRANT |
| Révoquer autorité provenant d'une délégation | **GRANT** + autorité sur la délégation source | GRANT |

### Règles anti-escalade révocation

1. **On ne peut pas révoquer ce qu'on n'a pas le droit d'accorder** — Même règle que GRANT : il faut GRANT sur les deux permissions.
2. **Auto-révocation protégée** — Si acteur a le rôle cible effectivement, interdit de retirer GRANT/DELEGATE/MANAGE sur `rbac.role_permissions` et `rbac.role_delegations` (s'applique à tous, Super Admin inclus).
3. **Révocation via délégation** — Si l'autorité vient d'une `role_delegation` ou `user_delegation`, la révocation se fait sur la **délégation source** (via RPC Phase 2), pas sur `role_permissions`.

### Distinction importante

| Table | Type de révocation | RPC responsable |
|---|---|---|
| `role_permissions` | Retirer capability d'un rôle | `revoke_role_permission` (Phase 1) |
| `role_delegations` | Révoquer une délégation | `revoke_role_delegation` (Phase 2) |
| `user_delegations` | Révoquer une délégation individuelle | `revoke_user_delegation` (Phase 2) |
| `user_roles` | Retirer rôle à un user | `revoke_user_role` (Phase ultérieure) |

---

## 9. RÈGLES DE SCOPE

### Réutilisation exclusive de `scope_includes()`

Toutes les RPC utilisent `has_effective_capability()` qui appelle `scope_includes()`.

### Hiérarchie confirmée (Decision 1 = Option A)

```
global ⊃ role:X ⊃ user:U (si U a rôle X)
```

### Relation `role ⊃ user` — Sémantique Decision 1

| scope_type | scope_value | Signification |
|---|---|---|
| `global` | NULL | Toute l'application |
| `role` | `role_id` | **Tous utilisateurs possédant ce rôle** (actif, non expiré, non révoqué) |
| `user` | `user_id` | Un utilisateur spécifique |
| `self` | NULL | **INTERDIT** dans délégations (Decision 2) |

### Vérification scope dans RPC

```sql
-- Dans grant_role_permission et revoke_role_permission
v_actor_has_authority := public.has_effective_capability(
    auth.uid(), 'GRANT', 'rbac.role_permissions', p_scope_type, p_scope_value
);
-- has_effective_capability utilise scope_includes internement
-- → scope demandé (p_scope_type, p_scope_value) doit être ⊆ scope détenu par l'acteur
```

### Aucune élargissement possible

- Si acteur a GRANT sur `rbac.role_permissions` en scope `role:admin`
- Il ne peut pas appeler `grant_role_permission(..., 'global')` → `has_effective_capability` renverra FALSE
- Il ne peut appeler qu'avec `p_scope_type='role'` et `p_scope_value='admin'` (ou plus restrictif)

---

## 10. MATRICE DE TESTS ATTENDUS

| ID | Scénario | RPC | Résultat attendu | Critique |
|---|---|---|---|---|
| T01 | Anon (non auth) | grant/revoke/get | Erreur / permission denied | 🔴 |
| T02 | Auth sans rbac.* | grant/revoke | `PERMISSION_INSUFFISANTE` (GRANT requis) | 🔴 |
| T03 | USE seulement sur rbac.role_permissions | grant/revoke | `PERMISSION_INSUFFISANTE` (GRANT requis) | 🔴 |
| T04 | MANAGE seulement sur rbac.role_permissions | grant | `PERMISSION_INSUFFISANTE` (GRANT requis) | 🔴 **Corrige bug actuel** |
| T05 | GRANT sur rbac.role_permissions, sans GRANT sur permission cible | grant (demande GRANT) | `ESCALADE_INTERDITE` | 🔴 |
| T06 | GRANT sur rbac.* + GRANT sur perm cible, scope global | grant (demande USE) | **SUCCÈS** | 🟢 |
| T07 | GRANT scope global, demande scope role:X | grant | **SUCCÈS** (global ⊃ role) | 🟢 |
| T08 | GRANT scope role:admin, demande scope global | grant | `PERMISSION_INSUFFISANTE` (scope insuffisant) | 🔴 |
| T09 | Acteur a GRANT sur perm cible, demande MANAGE (qu'il n'a pas) | grant | `ESCALADE_INTERDITE` | 🔴 |
| T10 | Acteur a GRANT + DELEGATE sur perm cible, demande DELEGATE | grant | **SUCCÈS** (a DELEGATE) | 🟢 |
| T11 | Acteur a GRANT sans DELEGATE, demande DELEGATE | grant | `ESCALADE_INTERDITE` | 🔴 |
| T12 | user_role expiré | grant/revoke | `PERMISSION_INSUFFISANTE` | 🔴 |
| T13 | user_role révoqué | grant/revoke | `PERMISSION_INSUFFISANTE` | 🔴 |
| T14 | Auto-GRANT : acteur s'ajoute GRANT sur rbac.role_permissions | grant | **INTERDIT** `AUTO_ESCALADE_INTERDITE` | 🔴 **Corrige faille** |
| T15 | Auto-DELEGATE : acteur s'ajoute DELEGATE sur rbac.role_delegations | grant | **INTERDIT** | 🔴 **Corrige faille** |
| T16 | Auto-révocation MANAGE sur rbac.role_permissions (rôle direct) | revoke | **INTERDIT** `AUTO_REVOCATION_INTERDITE` | 🔴 |
| T17 | Auto-révocation via délégation reçue | revoke | **INTERDIT** (même protection via autorité effective) | 🔴 **Corrige faille** |
| T18 | Super Admin auto-révocation MANAGE | revoke | **INTERDIT** (plus de bypass) | 🔴 |
| T19 | Rôle inexistant | grant/revoke | `ROLE_INEXISTANT` | 🟢 |
| T20 | Permission inexistante | grant/revoke | `PERMISSION_INEXISTANTE` | 🟢 |
| T21 | Doublon (permission existe) | grant | Upsert (merge true l'emporte) | 🟢 |
| T22 | get_role_permission sans USE sur rbac.* | get | `PERMISSION_INSUFFISANTE` | 🔴 **Corrige faille** |
| T23 | get_role_permission avec USE scope global | get | Retourne capabilities | 🟢 |
| T24 | get_role_permission avec USE scope role:X, cible hors scope | get | `SCOPE_INSUFFISANT` | 🔴 |
| T24 | get_role_permission scope user:U, cible = rôle de U | get | **SUCCÈS** | 🟢 |

---

## 11. POINTS NÉCESSITANT VALIDATION HUMAINE

| # | Point | Options | Recommandation |
|---|---|---|---|
| 1 | **MANAGE sur `rbac.role_permissions` — utilité ?** | A: Garder pour admin technique (schéma, index, audit) / B: Supprimer, tout passer par GRANT | **A** — MANAGE = "gérer la table", GRANT = "gérer le contenu" |
| 2 | **Auto-révocation USE — interdite ?** | A: Interdire aussi USE / B: Autoriser (inoffensif) | **B** — USE ne donne pas pouvoir d'escalade |
| 3 | **Super Admin bootstrap — comment récupérer si auto-révocation ?** | A: SQL direct (service_role) / B: Garder exception Super Admin | **A** — Exception unique dans `bootstrap_super_admin` seulement |
| 4 | **get_role_permission — USE suffit ou MANAGE/GRANT/DELEGATE aussi ?** | A: USE seulement / B: N'importe laquelle des 4 | **B** — Si on a MANAGE/GRANT/DELEGATE, on a implicitement droit de lecture |
| 5 | **Merge behavior grant_role_permission — garder ?** | A: true l'emporte (actuel) / B: replace complet / C: paramètre mode | **A** — Documenter : "pour désactiver, utiliser revoke" |
| 6 | **Scope `role` — confirmer sémantique "bénéficiaire" ?** | A: Oui (Decision 1) / B: Non | **A** — Aligné avec `scope_includes` S1 |

---

## 12. CHANGEMENTS REQUIS (RÉSUMÉ IMPLÉMENTATION)

### grant_role_permission
- [ ] Remplacer check `MANAGE` par `GRANT` sur `rbac.role_permissions` (ligne 147)
- [ ] Ajouter check anti-auto-GRANT/DELEGATE : si acteur a rôle cible effectif → interdire d'ajouter GRANT/DELEGATE sur `rbac.*`
- [ ] Garder check capability demandée ≤ détenue sur permission cible (ligne 162-174) ✅ déjà correct

### revoke_role_permission
- [ ] Remplacer check `MANAGE` par `GRANT` sur `rbac.role_permissions` (ligne 283)
- [ ] Remplacer détection auto-révocation (lignes 298-304) par `has_effective_capability(auth.uid(), 'USE', 'role', 'role', p_target_role_id)`
- [ ] Supprimer bypass Super Admin (lignes 306-307, 329-338)
- [ ] Appliquer protection auto-révocation à TOUS (incluant Super Admin)

### get_role_permission
- [ ] Ajouter check autorisation : `has_effective_capability(auth.uid(), 'USE', 'rbac.role_permissions', ...)` OU n'importe quelle capability sur `rbac.role_permissions`
- [ ] Ajouter paramètre `p_scope_type`, `p_scope_value` (défaut global) pour vérifier scope
- [ ] Si pas autorisé → `PERMISSION_INSUFFISANTE` / `SCOPE_INSUFFISANT`

### Migration
- [ ] Créer migration de correction (nouveau fichier, pas modification existante)
- [ ] `DROP FUNCTION` + `CREATE FUNCTION` pour les 3 RPC corrigées
- [ ] Pas de changement de données (permissions `rbac.*` et caps super_admin déjà correctes)

---

**Spécification complète. En attente de validation utilisateur avant implémentation.**