# P4.4 — Administration fonctionnelle & interface commune

**Date :** 2026-09-21
**Type :** Correction fonctionnelle de l'espace d'administration — listes d'utilisateurs
remises en état (contrat réel `admin_get_users`), comptes/rôles/accès réellement éditables
dans le navigateur (Liste des rôles assignables, matrice de capacités à 4 volets
USE/MANAGE/GRANT/DELEGATE), dashboard super_admin réparé, module Étapes/Résultats et
utilitaires basculés sur la sidebar commune `AppSidebar`, « Mon compte » gated par
`profile.view`/`profile.edit`, et **molette `revoke_role_permission` corrigée** (bug backend
réel découvert pendant la phase).
**État :** Rapport final. Migrations `list_assignable_roles()` + fix `revoke_role_permission`
appliquées + tests réels JWT 51/51 PASS + régressions (P4.1, P4.2, P4.2b, P4.2c, P4.3+edge)
au vert + build Vite OK.

---

## 1. Objet

Constats avérés à l'écran et vérifiés par probes JWT réels contre la stack locale
(`supabase_db_NTC_Assessment_Center_Moteur_Scoring`, http://127.0.0.1:54321) :

1. **Liste des utilisateurs (Admin / Utilisateurs) incomplète et "incohérente"** : le RPC
   `admin_get_users` renvoie `user_id`/`auth_created_at`/`role_ids` (et non `id`/
   `created_at`), provoquant `key id manquante` sur plusieurs lignes, avatars absents et
   dates de création manquantes.
2. **Dashboard super_admin : bloc "Fonctionnalités" à 0** et "derniers utilisateurs"
   triés/filtrés sur une clé inexistante (`u.created_at`) alors que la réponse du
   `select` composite est `features_bundle`, pas `features`.
3. **Création/édition de rôle limitée** : seuls `name` et `description` étaient éditables ;
   `is_assignable` et `parent_id` (colonnes existantes) ignorés ; suppression des rôles
   système protégée par un `id === 'super_admin'` hardcodé (le rôle `admin` système était
   supprimable !).
4. **Écran Accès non fonctionnel** : aucune matrice exploitable, pas de capacité
   `delegate` (le RPC gère pourtant les 4 capabilities), aucune prise en compte des
   contraintes d'anti-escalade (GRANT/DELEGATE sur `rbac.*` pour `super_admin`), diff
   sauvegardé de façon destructrice.
5. **Bug backend `revoke_role_permission`** (découvert en cours de phase, prouvé en
   probe) : le RPC lisait la ligne via `to_jsonb(rp)` (clés `can_use`, `can_manage`, …)
   mais récrivait/relisait avec les clés `use`/`manage`/… ⇒ **toute révocation supprimait
   la ligne entière**, même quand d'autres capacités restaient actives (C2/C2b en échec).
6. **Détail d'un utilisateur (admin) « éditait » un profil sans backend** :
   `updateUserProfile` échouait (RPC inexistant pour ce contexte), reset-password par
   l'admin sans protection affichée, culture de départ rôles figée sur `["candidate"]`, et
   l'écran tentait des écritures impossibles.
7. **Sidebars non communes** : module Résultats utilisait encore la `AdminSidebar`
   (super-admin) et des états de drawer ; `Utilisateurs` n'affichait pas la sidebar
   applicative ; « Mon compte » n'enforçait ni `profile.view` ni `profile.edit`.
8. **« Mon compte »** : écritures `setState` pendant le rendu (React), rôle affiché figé
   (premier rôle de la liste) au lieu des vrais rôles effectifs.

Objectif P4.4 : rendre l'administration **fonctionnelle** dans le navigateur — **toujours
sans refonte RBAC** (ni nouvelle permission, ni nouveau rôle, ni changement de politique
RLS) — et **unifier l'interface** (sidebar commune, gating de permissions réel).

---

## 2. Causes racines (probées en JWT réel)

### 2.1 Contrat `admin_get_users` ignoré côté frontend

- `listUsers.js` (= `Users` de l'API) renvoyait les colonnes telles quelles ; l'interface
  attendait `id`, `created_at`. **Prouvé** en probe : `admin_get_users` renvoie
  `user_id`, `auth_created_at`, `role_ids` (195 utilisateurs locaux, `auth_created_at`
  présent 195/195). Le frontend a été normalisé **côté service** :
  `id: row.user_id`, `created_at: row.auth_created_at ?? row.created_at`, `role_ids`
  conservé.

### 2.2 Dashboard : mauvaise lecture du payload composite

- `getSuperAdminStats` lisait `features?.length` alors que le `select` imbriqué renvoie
  `features_bundle` → `features_bundle?.features ?? []` ; « derniers utilisateurs »
  filtrés sur `u.created_at` (inexistant) → silhouettes `created_at` manquantes.

### 2.3 Rôles : capacités frontend manquantes + protection mal ciblée

- `Field.jsx` ne supportait ni `select` ni `textarea` ; `PageTitle` ne proposait pas de
  bouton d'action aligné à droite (alias `action`).
- `deleteRole.js` ne vérifiait pas `is_system` (un rôle système autre que `super_admin`
  était supprimable) ; `listRoles`/`createRole`/`updateRole` ignoraient
  `is_assignable`/`parent_id`.
- Aucune fonction SQL pour les rôles assignables — le frontend devait deviner ⇒
  **nouvelle fonction** `list_assignable_roles()` (edges `role_assignability`, acteur =
  `auth.uid()`), sans nouveau catalogue.

### 2.4 Accès : architecture matrice à 4 capacités incomplète

- `grant_role_permission`/`revoke_role_permission` gèrent `{use, manage, grant, delegate}`
  (RPC) mais l'UI et le hook `useAccessControl` n'exposaient pas `delegate` et n'avaient
  pas de diff sûr.
- **Bug `revoke_role_permission`** (cf. §1.5) — démontré : `revoke(['MANAGE'])` sur une
  ligne `use/grant` actifs ⇒ ligne supprimée (`delete` branché sur des clés inexistantes).

### 2.5 Comptes utilisateurs

- `admin_get_users` renvoie `role_ids` ; `AdminUserDetail` initialisait `roles` sur
  `["candidate"]` sans `slice()` ⇒ mutation de props + dérives.
- L'édit de profil et le reset-password « admin » n'ont aucun backend adapté au contexte
  (reset-password admin = edge protégée, retirée de l'UI ; l'édition de profil reste
  `Mon compte`).
- Promotion/démotion : `assignRole`/`removeRole` (RPC PRIVILEGED) existent dans les
  services (P4.2) ; le rôle `super_admin` étant **assignable** (graphe actuel :
  admin→super_admin), l'ajout est possible mais le retrait est **verrouillé sans le GRANT
  de promotion** (`canPromoteSuperAdmin`) — il n'existe pas de garde de graphe côté RPC
  `revoke_user_role`.

### 2.6 Sidebar commune et gating

- `AppSidebar` (P4.3, registry-driven) doit équiper toutes les pages d'administration et
  les utilitaires ; Résultats avait conservé `AdminSidebar` + drawer mobile.
- `Profile.jsx` ne vérifiait ni `profile.view` ni `profile.edit`.

---

## 3. Corrections apportées

### 3.1 Migrations (2, toutes appliquées)

- **`supabase/migrations/20260921120000_p4_4_administration_fonctionnelle.sql`**
  : `public.list_assignable_roles()` SECURITY DEFINER (`search_path=public`), renvoie
  `(assignable_role_id, assignable_role_name)` depuis `role_assignability` pour l'acteur
  (`auth.uid()`), REVOKE ALL / GRANT EXECUTE `authenticated`. Vérifié en probe :
  super_admin → [admin, candidate] ; admin → [candidate, super_admin] ; candidat → []. Les
  `roles.is_assignable` sont tous `t` dans la base actuelle — l'assignabilité réelle est
  **le graphe**, pas le flag.
- **`supabase/migrations/20260921123000_p4_4_revoke_role_permission_fix.sql`**
  : réécriture **signature inchangée** de `revoke_role_permission` — harmonisation des
  clés JSON (`can_*`), principalement : toutes les résolutions `v_new_caps->>'use'` →
  `->>'can_use'`, `jsonb_build_object(lower(v_cap),…)` → `'can_' || lower(v_cap)`.
  Gardes conservées : validation des paramètres, autorité `GRANT` effective sur
  `rbac.role_permissions` dans le scope, **anti-auto-révocation** (MANAGE/GRANT/DELEGATE
  sur les 4 permissions RBAC sensibles impossible sur son propre rôle effectif).
  Probed : `revoke(['MANAGE'])` sur `use/grant` conservés ⇒ ligne préservée.

### 3.2 Services

| Fichier | Changement |
|---|---|
| `src/services/auth/users/listUsers.js` | Normalisation du contrat `admin_get_users` : `id: row.user_id`, `created_at: row.auth_created_at ?? row.created_at`, `role_ids` conservé. |
| `src/services/dashboard/getSuperAdminStats.js` | `features: featuresBundle?.features ?? []` ; `recentUsers` filtrés sur `u.created_at` désormais présent. |
| `src/services/rbac/assignableRoles/listAssignableRoles.js` (+ `index.js`) | **Créés** : `rpc('list_assignable_roles')`. |
| `src/services/rbac/roles/listRoles.js` | `select` étendu : `description, is_assignable, parent_id, is_system`. |
| `src/services/rbac/roles/createRole.js` | Accepte `is_assignable`, `parent_id`. |
| `src/services/rbac/roles/updateRole.js` | Accepte `is_assignable`, `parent_id`. |
| `src/services/rbac/roles/deleteRole.js` | Refuse les rôles système (`is_system` ⇒ `ROLE_SYSTEME_INSUPPRIMABLE`). |

### 3.3 Accès : hook + écran (USE / MANAGE / GRANT / DELEGATE)

- `src/hooks/rbac/useAccessControl.js` : matrice `{ roleId: { permissionId: { use, manage,
  grant, delegate } } }` (chargée depuis `rolePermissions` de l'API), `baseMatrix`
  (diff), `toggleCapability(roleId, permissionId, key)`, `hasChanges`, `save()` :
  révoque chaque capability passée à `false` puis regrant les lignes modifiées avec
  l'objet complet, rechargement après succès, états `loading/saving/error/success`.
- `src/pages/SuperAdminAccess.jsx` : tableau **Permission | USE | MANAGE | GRANT |
  DELEGATE**, sélecteur de rôle, cellules **verrouillées** GRANT/DELEGATE pour
  `rbac.*` quand le rôle sélectionné est `super_admin` (anti-escalade côté UI,
  `startsWith("rbac.")`), bouton Enregistrer gated par `hasChanges` (diff).

### 3.4 Rôles

- `src/pages/SuperAdminRoles.jsx` : formulaire avec `is_assignable` (select oui/non) et
  `parent_id` (select `list_assignable_roles` + rôles personnalisés de la liste) ;
  badge **SYSTÈME** via `is_system` ; pour les rôles système : champs verrouillés et
  suppression masquée ; suppression protégée par `isSystemRole` (fini le
  `id === 'super_admin'` hardcodé).

### 3.5 Comptes & utilisateurs

- `src/pages/SuperAdminAccounts.jsx` : plus de `resetPassword`/`updateUserProfile`/
  `canPromoteSuperAdmin` dans l'UI ; création candidate **+ admin** gated par
  `assignableRoleIds` + `canPromoteAdmin` ; sélecteur "Rôle initial" ; `handleRoleChange
  (userId, roleId, add)` (assignRole/removeRole, conforme P4.2b) ; `assignableRoles`
  transmis au détail.
- `src/pages/AdminUsers.jsx` : sidebar commune (`AppSidebar` ×2), statut via
  `updateUserActive`, `listAssignableRoles`, plus de `resetPassword`/`updateUserProfile`.
- `src/pages/AdminUserDetail.jsx` : **affichage en lecture seule** du profil (aucune
  écriture admin sans backend) ; rôle(s) initialisé `(user.role_ids || []).slice()` ;
  lignes de rôles dérivées de `assignableRoles` (candidate/add revocable=t ; admin
  revocable=canPromoteAdmin ; super_admin addable si `assignableRoles` l'inclut,
  revocable=canPromoteSuperAdmin) — le retrait d'un rôle privilégié reste soumis au
  GRANT de promotion (anti-démotion accidentelle) ; statut actif/inactif via
  `updateUserActive`.

### 3.6 Interface commune

- `src/pages/AdminResultats.jsx` : `AppShell maxWidth={1000} sidebar={<AppSidebar />}` ;
  suppression de `AdminSidebar`, des états `sidebarQuery`/`sidebarFilters`/
  `mobileSidebarOpen`, du drawer mobile et de `handleLogout` ; `hasRole` conservé ; les
  constantes métier (`METIERS`, `AXIS_OPTIONS`) et `handleNavigate` conservées car
  utilisées par le contenu de la page.
- `src/components/ui/Field.jsx` : support `type="select"` (label + `<select>`) et
  `type="textarea"`/`multiline`.
- `src/components/ui/PageTitle.jsx` : alias `action` pour le slot `right`.

### 3.7 Mon compte

- `src/pages/Profile.jsx` : carte "permission refusée" si `!can('profile.view')` ; champs
  et bouton Enregistrer conditionnés par `can('profile.edit')` ; synchro `formData` dans
  `useEffect` (plus de `setState` en rendu) ; `useState(EMPTY_FORM)` ; rôle affiché par
  `computeRoleDisplay(roles)` (rôles effectifs, plus le premier de la liste) ;
  sidebar commune conservée.

---

## 4. Fichiers modifiés / créés

| Fichier | Statut |
|---|---|
| `supabase/migrations/20260921120000_p4_4_administration_fonctionnelle.sql` | **Créé** — `list_assignable_roles()` SECURITY DEFINER (GRANT authenticated). |
| `supabase/migrations/20260921123000_p4_4_revoke_role_permission_fix.sql` | **Créé** — fix des clés `can_*` de `revoke_role_permission` (signature inchangée). |
| `src/services/auth/users/listUsers.js` | Normalisation `user_id`→`id`, `auth_created_at`→`created_at`. |
| `src/services/dashboard/getSuperAdminStats.js` | `features_bundle?.features` + filtre `u.created_at`. |
| `src/services/rbac/assignableRoles/listAssignableRoles.js`, `index.js` | **Créés** — RPC `list_assignable_roles`. |
| `src/services/rbac/roles/{listRoles,createRole,updateRole,deleteRole}.js` | `is_assignable`/`parent_id`/`is_system`. |
| `src/hooks/rbac/useAccessControl.js` | Matrice 4 capacités + diff + save sûr. |
| `src/pages/SuperAdminAccess.jsx` | Tableau Permission × USE/MANAGE/GRANT/DELEGATE, verrous UI. |
| `src/pages/SuperAdminRoles.jsx` | `is_assignable`/`parent_id`/protection système. |
| `src/pages/SuperAdminAccounts.jsx` | Comptes fonctionnels (assignableRoles, Rôle initial, P4.2b). |
| `src/pages/AdminUsers.jsx` | Sidebar commune, `updateUserActive`, assignableRoles. |
| `src/pages/AdminUserDetail.jsx` | Lecture seule profil + rôles par graphe + promotions. |
| `src/pages/AdminResultats.jsx` | Sidebar commune `AppSidebar`, retrait drawer/AdminSidebar. |
| `src/pages/Profile.jsx` | Gating `profile.view`/`profile.edit`, sync useEffect, rôle effectif. |
| `src/components/ui/Field.jsx`, `src/components/ui/PageTitle.jsx` | `select`/`textarea` ; alias `action`. |
| `tests/supabase/manual/test_p4_4_admin_functional.js` | **Créé** — test réel JWT (51 assertions). |

Non modifiés : RBAC/RLS/politiques, permissions, rôles, guards, `src/routes/*`,
`SuperAdminSidebar.jsx`, `admin_reset_user_password` (phase 6), edge
`admin-reset-password`, `src/lib/theme.js`.

---

## 5. Validation

### 5.1 Tests réels JWT (Supabase local http://127.0.0.1:54321)

`test_p4_4_admin_functional.js` — **51/51 PASS** (README : `node
tests/supabase/manual/test_p4_4_admin_functional.js`) :

| Groupe | Vérifié (points saillants) |
|---|---|
| **A. Comptes** | `list_assignable_roles` par acteur (super_admin→[admin,candidate] ; admin→[candidate,super_admin] ; candidat→[]) ; `admin_get_users` : rows>0, `user_id`+`auth_created_at` partout (195/195) ; static `SuperAdminAccounts` sans resetPassword/updateUserProfile/canPromoteSuperAdmin + « Rôle initial » ; `listUsers` normalisé (`user_id`→`id`, `auth_created_at`→`created_at`). |
| **B. Rôles** | CRUD avec `is_assignable`/`parent_id` (RPC réel) ; candidat refusé (RLS `roles_manage_super_admin`) ; suppression custom ok ; protection **`is_system`** dans page + service. |
| **C. Accès** | GRANT indépendant `use+grant` sans `manage`/`delegate` (t/f/t/f lus en DB) ; **revoke MANAGE puis GRANT : autres capacités préservées**, `use` conservé (fix §3.1) ; anti-escalade : GRANT sur `rbac.*` pour son propre rôle super_admin **REFUSÉ** ; candidat `grant_role_permission` refusé ; statique : matrice à 4 capacités + `toggleCapability`, colonnes GRANT/DELEGATE, verrou `startsWith("rbac.")`. |
| **D. Pages & Fonctionnalités** | lecture candidat ok ; insertion fonctionnalité candidat **REFUSÉE (RLS)** même avec `page_id` valide ; création super_admin ok puis suppression. |
| **E. Dashboard** | statique `featuresBundle?.features` + `features: features.length` + `u.created_at` ; compteur fonctionnalités > 0 en réel. |
| **F. Sidebars** | Résultats : `AppSidebar` et plus d'`AdminSidebar`/`mobileSidebarOpen` ; Utilisateurs : `AppSidebar` ×2 ; plus de resetPassword/updateUserProfile. |
| **G. Compte** | `profile.view`/`profile.edit` employés ; `useState(EMPTY_FORM)` + synchro en `useEffect` (dette `syncedProfileId` absente) ; rôle effectif (`roles.length` dérivé de `role_ids`). |
| **H. Cohérence** | `ApplicationLayout` = Sidebar commune ; trio {Comptes, Utilisateurs, Détail} sur `useEffectiveAuthority` ; Accès piloté par `useAccessControl` (backend source de vérité) ; plus de `setUserRoles`. |

### 5.2 Régressions

| Suite | Résultat |
|---|---|
| **P4.1** navigation super admin | **32/32 PASS** |
| **P4.2** actions utilisateurs / capacités effectives | **55/55 PASS** |
| **P4.2b** signature `onRoleChange(userId, roleId, add)` | **22/22 PASS** |
| **P4.2c** stabilisation frontend | **17/17 PASS** |
| **P4.3** phase 7 + edge reset-password | **34/34 + 4/4 PASS** |
| **P4.4** (nouveau) | **51/51 PASS** |

### 5.3 Build / lint

- `npm run build` : ✅ OK (avertissement chunk > 500 kB pré-existant, hors périmètre).
- `npx eslint` sur tous les fichiers modifiés/créés (`AdminUserDetail`,
  `SuperAdminAccounts`, `AdminUsers`, `AdminResultats`, `Profile`, `SuperAdminRoles`,
  `SuperAdminAccess`, `useAccessControl`, `listUsers`, `getSuperAdminStats`,
  `assignableRoles/*`, `Field`, `PageTitle`, nouveau test) : ✅ **aucune erreur, aucune
  alerte** — les effets de chargement ont été mis conformes à
  `react-hooks/set-state-in-effect` (tick `setTimeout(0)` pour le chargement initial,
  synchro `formData` de `Profile` conservée sans setState synchrone dans l'effet), imports
  nettoyés (`INK`, `User`), suppression d'une directive eslint inutile.
- Écrans modifiés conformes au contrat statique P4.2/P4.2b (trio `useEffectiveAuthority`,
  `assignRole`/`removeRole` branchés, plus de `setUserRoles`).

---

## 6. Points hors périmètre (délibérément non traités)

- **Aucune refonte RBAC** : ni nouvelle permission, ni nouveau rôle, ni changement de
  politique RLS (les écritures catalogues restent structurées par
  `roles/pages/features_manage_super_admin`).
- `roles.is_assignable` reste vérifié côté DB/graphe ; l'UI s'appuie sur
  `list_assignable_roles()` (le flag est `t` partout actuellement, **c'est le graphe qui
  fait foi**).
- Reset-password **utilisateur final** et edge `admin-reset-password` : conservés
  (utilisés par « Mon compte »/ForgotPassword) — seul l'UI admin a été nettoyée.
- `AdminResultats` : logique métier (étapes, axes, résultats) intégralement conservée.
- Dette eslint pré-existante et avertissement de chunk : chantiers séparés.
- `src/lib/theme.js` non touché.

---

## 7. Décision

✅ **P4.4 VALIDÉE — READY_FOR_NEXT** — administration **fonctionnelle** dans le navigateur :
listes utilisateurs remises en état (normalisation service), comptes + rôles +
accès éditables (rôles assignables par graphe, matrice à 4 capacités avec diff sûr et
verrous anti-escalade), dashboard réparé, sidebar commune partout, « Mon compte » gated par
permissions réelles, et **bug backend `revoke_role_permission` corrigé** (les révocation
partielles préservent les capacités restantes). Tests réels JWT 51/51, régressions
intégrales au vert, build OK, intégration Vite validée.