# P5 — Plateforme métier & configuration administrable depuis l'interface

**Date :** 2026-09-22
**Type :** Finalisation du back-office en **produit métier NTC Assessment** — tout ce qui est
administrable par le Super Admin devient **configurable depuis l'interface** (rôles, permissions
à 4 capacités, **assignabilité des rôles**, pages, fonctionnalités, comptes, accès), plus une
garde d'**anti-verrouillage** backend, des rôles **dynamiques** (aucun ensemble fermé dans l'UI),
et le **dashboard/pages/fonctionnalités** fiabilisés. Validation en continu : étape par étape,
backend d'abord (tests JWT réels), puis interface.
**État :** Rapport final. Migrations `20260922100000_p5_anti_verrouillage.sql` +
`20260922110000_p5_assignabilite_config.sql` créées, appliquées localement puis **poussées
remote** (parité 25/25). Test `test_p5_admin_config.js` **27/27 PASS** (18 backend + 9 front),
régressions **P4.4 51/51 PASS**, lint 0 erreur sur tous les fichiers P5/P4.4, build Vite OK.

---

## 1. Objet

P4.4 a rendu l'administration **fonctionnelle** (listes réelles, matrice 4 capacités, contrat
`revoke_role_permission` corrigé). P5 transforme ce back-office en produit métier :

1. **Capacités USE / MANAGE / GRANT / DELEGATE réellement indépendantes** et configurées
   depuis l'écran Accès (structure en place en P4.4, validée ici comme socle).
2. **Assignabilité des rôles configurable depuis l'interface** : ajout d'une **matrice
   « assigneur × assignable »** (écran Accès) pilotée par `role_assignability`, gated par la
   capacité **DELEGATE** sur `rbac.role_assignability` (les deux sens : liste lisible par le
   super_admin ; écriture via `set_role_assignability`).
3. **Rôles dynamiques partout** : plus de `ROLE_LABELS`/`ROLE_DESC` ni d'ensemble fermé
   `{candidate, admin, super_admin}` dans Comptes / Utilisateurs / Détail — les noms, badges
   « système », filtres, options de rôle initial et lignes d'attribution sont **dérivés de
   `listRoles()`**. L'option « Rôle initial » d'un nouveau compte est restreinte au graphe
   d'assignabilité de l'acteur.
4. **Anti-verrouillage** (garde métier) : il doit rester **impossible** de faire disparaître
   le dernier rôle fournissant GRANT sur `users.change_role` alors que des utilisateurs actifs
   en dépendent — que ce soit par **révocation** ou par **suppression de rôle**.
5. **Pages** : distinction **« Implémentée » / « Déclarée »** croisée avec le **registre de
   routes frontend** (source de vérité), sans changement de schéma.
6. **Fonctionnalités** : correction du bug « + Ajouter » (la page parente du vide d'état était
   écrasée) + dette lint (initialisation d'effets conformes `react-hooks/set-state-in-effect`).
7. **Dashboard** : ordre des rôles affiché **sans priorité hardcodée**.

Contraintes utilisateur respectées : **aucune refonte RBAC** (ni Casbin/OpenFGA/Keycloak),
le super_admin administre **rôles, accès, assignabilité, pages, fonctionnalités, comptes**
(et **pas** les données personnelles/mots de passe des utilisateurs), backend source de
vérité (RPC + RLS), route registry frontend seul juge des routes implémentées, `theme.js`
non modifié, données/résultats/candidats/rôles existants intacts.

---

## 2. Décision : l'anti-verrouillage par capacité, pas par nom de rôle

### 2.1 Modèle d'administration des rôles

- `role_permissions` n'a **pas de colonne de scope** : les grants de rôle sont **globaux** par
  construction. `has_effective_capability(uid, cap, perm, scope_type, scope_value)` reste le
  moteur d'évaluation (migration `20260916140000`).
- Le RPC `revoke_user_role(uid, role_id)` (P4.2) exige le **GRANT** effectif de
  `users.change_role` ; il ne protégeait (phase 4) que l'anti-auto-révocation.
- Un rôle fournit l'administration des rôles si un **GRANT global** sur `users.change_role`
  lui est attaché — capacité effective pour un utilisateur donné = GRANT via ses rôles
  **ou** via les délégations `grant` (rôles ou utilisateurs) de scope global.

### 2.2 Gardes (prouvées en probe JWT réel, test P5 A1–A5)

- **Helper interne** `public.users_with_role_change_grant()` : retourne les `user_id` actifs
  ayant le GRANT effectif global sur `users.change_role` (sources : `role_permissions`
  `can_grant`, `role_delegations`/`user_delegations` `grant` de scope `global` ; aucun nom de
  rôle codé). Exécution retirée à `public`/`anon`/`authenticated`, réservée au
  `service_role`.
- **`revoke_user_role` réécrite** (signature inchangée) : après la révocation, si plus aucun
  utilisateur actif ne dispose du GRANT `users.change_role` ⇒ `PERMISSION_INSUFFISANTE`
  (transaction annulée). Comportement nominal conservé sinon (anti-auto-révocation gardé).
- **Trigger `roles_before_delete_guard`** (BEFORE DELETE sur `roles`) : suppression interdite
  si le rôle supprimé est encore fournisseur de GRANT `users.change_role` **et** qu'il reste
  au moins un utilisateur actif en dépendant **sans** autre fournisseur ⇒
  `ROLE_INSUPPRIMABLE: Ce rôle est le dernier à fournir l'administration des rôles
  (GRANT sur users.change_role)`.

> **Pourquoi cette double garde ?** Comme les grants de rôle sont globaux, l'acteur qui révoque
> reste lui-même toujours détenteur du GRANT ⇒ la garde dans `revoke_user_role` est une
> **défense en profondeur** (structurellement non atteignable par l'UI aujourd'hui). La garde
> **réellement atteignable** est la **suppression de rôle** (`DELETE` REST sur `roles`,
> RLS-gated) : le test P5 supprime tous les autres fournisseurs, rend le rôle de test unique
> fournisseur, puis vérifie que le DELETE est refusé, et que la suppression redevient possible
> une fois un autre fournisseur restauré.

### 2.3 Assignabilité configurable

- Existait déjà : `set_role_assignability(assigner, assignable, allow)` (P1.3) exige DELEGATE
  effectif sur `rbac.role_assignability` (scope global).
- **Nouvelle lecture graphe** `public.list_role_assignability()` → `table
  (assigner_role_id, assignable_role_id)` : le graphe **complet** (super_admin a DELEGATE
  `('super_admin','rbac.role_assignability',true,true,true,true)` en seed), gated par
  `has_effective_capability(auth.uid(),'DELEGATE','rbac.role_assignability','global',null)`.
  Sans ce DELEGATE ⇒ `PERMISSION_INSUFFISANTE: DELEGATE sur rbac.role_assignability requis`.
- Contraintes d'écriture conservées : pas d'auto-assignation (`VALIDATION_ERREUR`) ; rôle
  assignable existant requis (`ROLE_INEXISTANT`).

---

## 3. Corrections et ajouts

### 3.1 Migrations (2, appliquées, puis poussées remote)

- **`supabase/migrations/20260922100000_p5_anti_verrouillage.sql`** : `users_with_role_change_grant()`
  (helper interne, revoke execute public/anon/authenticated), `revoke_user_role` réécrite avec
  garde `ANTI_VERROUILLAGE`, trigger `roles_before_delete_guard`.
- **`supabase/migrations/20260922110000_p5_assignabilite_config.sql`** : RPC
  `list_role_assignability()` (SECURITY DEFINER `search_path=public`, garde interne
  DELEGATE — lecture seule), GRANT EXECUTE `authenticated`, revoke `public`/`anon`.

### 3.2 Services

| Fichier | Changement |
|---|---|
| `src/services/rbac/roleAssignability/listRoleAssignability.js`, `setRoleAssignability.js`, `index.js` | **Créés** — `rpc('list_role_assignability')` / `rpc('set_role_assignability', { p_assigner_role_id, p_assignable_role_id, p_allow })`. |
| `src/pages/AdminUsers.jsx` | Rôles chargés via `listRoles()` (en parallèle de `listUsers`/`listAssignableRoles`) ; filtres et chips **dynamiques** ; badges système via `is_system` ; `roles` transmis au détail. |
| `src/pages/SuperAdminAccounts.jsx` | Idem + option **« Rôle initial »** = `roles ∩ assignableRoleIds` (`initialRoleOptions`) ; retrait du gating `canPromoteAdmin` des options (le backend gère) ; `roles` transmis au détail. |
| `src/pages/AdminUserDetail.jsx` | Prop `roles` ; lignes d'attribution **dérivées** de la liste (`addable = assignableRoles.includes`, `revocable = canManageRoles` — conforme au backend qui ne gate pas le retrait par promote) ; suppression `ROLE_LABELS`/`ROLE_DESC`/`canPromoteAdmin`/`canPromoteSuperAdmin` ; badge « rôle système » via `is_system`. |
| `src/components/admin/RoleAssignabilityMatrix.jsx` | **Créé** — matrice assigneur × assignable (case « — » sur l'auto-assignation), diff avant sauvegarde, sauvegarde par ensemble de `set_role_assignability`, gate `can('rbac.role_assignability','DELEGATE')`, états loading/saving/message. |
| `src/pages/SuperAdminAccess.jsx` | Intègre `RoleAssignabilityMatrix` sous la matrice de permissions. |
| `src/pages/SuperAdminPages.jsx` | Colonne **Implémentation** : `Implémentée` (vert) si le chemin existe dans `flattenPaths(routes)` du registre, sinon `Déclarée` (ambre, tooltip explicatif) ; `useEffect` conforme lint. |
| `src/pages/SuperAdminFeatures.jsx` | Fix bug **« + Ajouter »** : `openCreateModal(pageId)` reçoit la page de l'état vide au lieu d'écraser sur `pages[0]` ; `useEffect` conforme lint. |
| `src/pages/SuperAdminDashboard.jsx` | `getRoleDisplayName` : premier rôle de la liste (plus de priorité `["super_admin","admin","candidate"]`). |
| `tests/supabase/manual/test_p5_admin_config.js` | **Créé** — 27 assertions (voir §5). |
| `tests/supabase/manual/test_p4_4_admin_functional.js` | Assertion statique G5 mise à jour : rôles **dynamiques** (prop `roles`, plus de `ROLE_LABELS` ni `canPromote*`). |

Non modifiés : RBAC/RLS/politiques, permissions, rôles, guards, registry (seulement importé en
lecture), super_admin seed, `theme.js`, données existantes.

---

## 4. Fichiers modifiés / créés (détail)

| Fichier | Statut |
|---|---|
| `supabase/migrations/20260922100000_p5_anti_verrouillage.sql` | **Créé** + push remote |
| `supabase/migrations/20260922110000_p5_assignabilite_config.sql` | **Créé** + push remote |
| `src/services/rbac/roleAssignability/{listRoleAssignability,setRoleAssignability,index}.js` | **Créés** |
| `src/components/admin/RoleAssignabilityMatrix.jsx` | **Créé** |
| `src/pages/SuperAdminAccess.jsx` | Intègre la matrice d'assignabilité |
| `src/pages/AdminUsers.jsx` | Rôles dynamiques (filtre, chips, prop) |
| `src/pages/SuperAdminAccounts.jsx` | Rôles dynamiques + rôle initial par graphe |
| `src/pages/AdminUserDetail.jsx` | Prop `roles`, lignes dynamiques, fin de l'ensemble fermé |
| `src/pages/SuperAdminPages.jsx` | Badge Implémentée/Déclarée (registry) + lint effet |
| `src/pages/SuperAdminFeatures.jsx` | Fix « + Ajouter » (page_id) + lint effet |
| `src/pages/SuperAdminDashboard.jsx` | `getRoleDisplayName` sans priorité hardcodée |
| `tests/supabase/manual/test_p5_admin_config.js` | **Créé** |
| `tests/supabase/manual/test_p4_4_admin_functional.js` | G5 dynamique |

---

## 5. Validation

### 5.1 Test P5 — configuration administrable (JWT réels, Supabase local)

`test_p5_admin_config.js` — **27/27 PASS** :

| Groupe | Vérifié (points saillants) |
|---|---|
| **A. Anti-verrouillage** | GRANT `users.change_role` posé sur un rôle de test via la molette RPC ; avec **tous les autres fournisseurs mis à `can_grant=false`**, la suppression du rôle de test est **REFUSÉE** (`ROLE_INSUPPRIMABLE`) et le rôle reste présent ; sans GRANT, **aucun `revoke_user_role` possible** (`PERMISSION_INSUFFISANTE`) ⇒ il est structurellement impossible de se retrouver sans administrateur de rôles ; restauration complète en `finally`, puis suppression possible à nouveau (A5) ; `revoke` nominal inchangé. |
| **B. Assignabilité** | `list_role_assignability` accessible au super_admin, graphe contenant `super_admin->admin` et `admin->candidate`, aucune auto-assignation ; `set_role_assignability(admin, roleX, true)` persisté puis `false` retiré ; self-assignation refusée (`VALIDATION_ERREUR`) ; rôle assignable inexistant refusé (`ROLE_INEXISTANT`) ; candidat **refusé** en lecture et en écriture (`PERMISSION_INSUFFISANTE: DELEGATE sur rbac.role_assignability requis`). |
| **E. Frontend (statique)** | services list/set via RPC ; matrice (list + set + gate DELEGATE) ; intégration dans `SuperAdminAccess` ; `listRoles` dans Utilisateurs + Comptes ; Détail dynamique sans `ROLE_LABELS`/`canPromoteSuperAdmin` ; `initialRoleOptions` ; badge `Implémentée` + `IMPLEMENTED_PATHS` (registry) ; `openCreateModal(page.id)` ; dashboard sans `const priority`. |

### 5.2 Régressions

| Suite | Résultat |
|---|---|
| **P4.4** administration fonctionnelle (G5 mis à jour) | **51/51 PASS** |
| **P5** (nouveau) | **27/27 PASS** |

### 5.3 Build / lint

- `npm run build` : ✅ OK (avertissement chunk > 500 kB pré-existant, hors périmètre).
- `npx eslint` sur tous les fichiers P5/P4.4 (matrice, services `roleAssignability/*`,
  `SuperAdminAccess`, `AdminUsers`, `SuperAdminAccounts`, `AdminUserDetail`, `SuperAdminPages`,
  `SuperAdminFeatures`, `SuperAdminDashboard`) : ✅ **aucune erreur, aucune alerte**.
- `npx supabase migration list --linked` : **25/25 appliquées localement et en remote**
  (les 2 migrations P5 poussées par `supabase db push --linked`).

---

## 6. Points hors périmètre (délibérément non traités)

- **Aucune refonte RBAC** ; Casbin/OpenFGA/Keycloak évoqués seulement comme note « future ».
- Le super_admin **n'administre pas** les données personnelles/mots de passe des utilisateurs
  (rôles, accès, assignabilité, pages, fonctionnalités, comptes uniquement).
- Suppression d'un **utilisateur** (danger sur l'historique candidat) : non traité ici.
- Dette eslint pré-existante des modules hors P5/P4.4 (AuthContexts, Register, ForgotPassword,
  ResetPassword, TestApp, tests legacy) : chantier séparé, inchangée.
- Avertissement chunk bundler : hors périmètre.

---

## 7. Décision

✅ **P5 VALIDÉE** — le back-office NTC Assessment est un **produit métier** : tout ce qui est
administrable est configurable depuis l'interface (rôles dynamiques sans ensemble fermé,
capacités USE/MANAGE/GRANT/DELEGATE indépendantes, **matrice d'assignabilité** gated DELEGATE,
pages croisées avec le registre, fonctionnalités réparées), et le **moteur garantit qu'un
administrateur de rôles ne peut jamais disparaître** (anti-verrouillage par capacité prouvé en
probe). Tests réels JWT 27/27 (P5) + 51/51 (P4.4), lint/build propres, migrations poussées
remote. Reste : vérification navigateur finale sur les comptes de production (action
utilisateur) puis poursuite du périmètre métier (candidats, évaluations, résultats, rapports).