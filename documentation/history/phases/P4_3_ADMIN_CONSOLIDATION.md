# P4.3 — Consolidation de l'espace d'administration (corrections backend ciblées)

**Date :** 2026-09-21
**Type :** Consolidation de l'espace d'administration — actions « Créer un compte » et
« Activer/Désactiver » rendues réellement utilisables dans le navigateur, edge
admin-reset-password réparé, sidebar « Mon compte » rendue cohérente (registry).
**État :** Rapport final. Migration phase 7 appliquée + tests réels JWT 34/34 + edge 4/4 +
régressions complètes (P4.1, P4.2, P4.2b, P4.2c, P3 S6/S7/S9-A/S9-B/S10, Phase 3, Phase 4) +
build + eslint fichiers modifiés.

---

## 1. Objet

Constats avérés à l'écran et prouvés par probes JWT réels contre la stack locale
(`supabase_db_NTC_Assessment_Center_Moteur_Scoring`), conformément au contrat P4.2
(`createUserAccount`/`updateUserActive` passaient par l'API GoTrue admin) :

1. **« Créer un compte » inutilisable dans le navigateur** :
   `supabase.auth.admin.createUser` depuis un client publishable ⇒ `User not allowed`
   (GoTrue exige le rôle `service_role`). Aucune autorité `users.manage`/`USE` effective
   n'était enforce côté backend.
2. **« Activer/Désactiver » inutilisable dans le navigateur** :
   `supabase.auth.admin.updateUserById` ⇒ même `User not allowed`. Aucune autorité
   `users.edit`/`USE` effective n'était enforce côté backend.
3. **Edge `admin-reset-password` cassée à l'exécution** : lookup email via
   `from('auth.users')` ⇒ `Could not find the table 'public.auth.users' in the schema
   cache` (auth.users n'est pas exposé via PostgREST) ; autorité via `has_permission`
   (legacy) au lieu du couple GRANT `users.change_role` scoped.
4. **« Mon compte » sidebar incohérente** : version super-admin registry-driven, version
   admin réduite à un avatar, version candidat Herdsman/battery.

Objectif P4.3 : rendre l'interface d'administration réellement exploitable **sans ouvrir un
nouveau chantier RBAC** (pas de refonte, pas de nouvelles permissions, pas de remplacement
Supabase), en corrigeant **uniquement** les protections backend et la cohérence de la
sidebar de `Profile`.

---

## 2. Causes racines (probées en JWT réel)

### 2.1 `auth.admin.createUser` / `auth.admin.updateUserById` refusés côté navigateur

- Les services frontend `createUserAccount.js` et `updateUserActive.js` appelaient
  `supabase.auth.admin.*`, strictement réservé au rôle `service_role`. Le client
  publishable (JWT `authenticated`) reçoit `User not allowed` — **démontré** :
  `auth.admin.createUser` et `auth.admin.updateUserById` avec JWT super_admin local ⇒
  erreur, alors que le même utilisateur exécute sans erreur les RPC `*_manage` et édite via
  RLS.
- Autorité réelle de l'action (« qui peut créer un compte ? ») : piste de permissions
  existantes.
  - `users.manage` (USE) pour la création — présent dans le catalogue (`permissions`),
    grantée aux rôles super_admin (défauts), **aucune nouvelle permission créée**.
  - `users.edit` (USE) pour l'activation/désactivation — présente, grantée admin +
    super_admin (P3-8 : `users.edit` t/t), **aucune nouvelle permission créée**.

### 2.2 Edge `admin-reset-password` : lookup `auth.users` impossible + autorité legacy

- `from('auth.users')` via PostgREST ⇒ erreur (table hors schéma REST). Constaté au
  runtime.
- Autorité posée sur `has_permission(user_id, 'users.change_role')` — legacy, non scoped
  (ignorait le GRANT `users.change_role` user/global de la phase 4).
- La fonction `admin_reset_user_password(target_user_id)` (phase 6) fait déjà le travail :
  SECURITY DEFINER + `has_effective_capability(GRANT, users.change_role, user, target)` +
  raise si cible absente. L'edge ne l'utilisait pas.

### 2.3 Sidebar « Mon compte » triplement incohérente

- `Profile.jsx` construisait une sidebar par rôle : `SuperAdminSidebar` (registry),
  sidebar admin vide (avatar seul), `BatterySidebar` candidat (sans données batterie).
- Les routes/comptes/modifier-mdp sont déjà registry-driven (`buildNavigation` +
  autorité effective) et indépendantes du rôle de la page (`/compte` accessible à tous).

---

## 3. Corrections apportées

### 3.1 Migration `20260921100000_p1_3_4_b_s2_b_phase7_admin_security_fix.sql`

Nouvelle migration, **2 fonctions SECURITY DEFINER** uniquement (pas de RLS, pas de
permission, pas de rôle créés — mécanisme idempotent, grant/revoke) :

- **`admin_create_user(p_email, p_password, p_first_name='', p_last_name='')` → jsonb**
  - Autorité : `has_effective_capability(auth.uid(), 'USE', 'users.manage', 'global', NULL)`
    sinon `ACCES_REFUSE`.
  - Validation : email (format), unicité (`lower(email)` dans `auth.users`), mot de passe
    ≥ 6 caractères.
  - Insertion `auth.users` au **pattern GoTrue** : `instance_id` zéro, `aud`/`role`
    `authenticated`, `encrypted_password = extensions.crypt(p_password,
    extensions.gen_salt('bf',10))` (**`$2a$10$` compatible GoTrue**, vérifié par la
    connexion réelle du compte créé), `email_confirmed_at = now()`, tokens `''` (y compris
    `recovery_token` — GoTrue scanne ces colonnes en string non-null ;
    constat : `recovery_token NULL` ⇒ `error finding user: Scan error on column index 31`),
    meta conforme (sub/email/email_verified/phone_verified + prénom/nom).
  - Insertion `auth.identities` (provider `email`, `provider_id = user_id`, miroir du
    pattern des comptes existants).
  - Le **trigger existant `handle_new_user`** crée automatiquement profil `profiles` +
    rôle `candidate` (vérifié : rôle candidate, pas de RLS nécessaire) ; la fonction
    complète ensuite `profiles.first_name/last_name`.
  - `jsonb {user_id, email}`.
  - `GRANT EXECUTE TO authenticated` / `REVOKE FROM anon`.
- **`admin_set_user_active(p_target_user_id, p_active)` → void**
  - Autorité : `has_effective_capability(auth.uid(), 'USE', 'users.edit', 'global', NULL)`
    sinon `ACCES_REFUSE`.
  - Cible : présence dans `auth.users`, sinon `UTILISATEUR_INEXISTANT`.
  - `auth.users.banned_until = now()+87600h` (p_active=false) ou `NULL` (p_active=true)
    **et** `profiles.status = inactive|active` (synchronisation avec l'affichage
    `admin_get_users.p.status`).
  - `GRANT EXECUTE TO authenticated` / `REVOKE FROM anon`.

> Remarque : `admin_reset_user_password` (phase 6) est conservée telle quelle et devient
> la porte d'entrée de l'edge (§3.2).

### 3.2 Edge `admin-reset-password/index.ts`

- Autorité + existence cible : `supabaseUser.rpc('admin_reset_user_password',
  { target_user_id })` ⇒ toute erreur (RAISE du RPC scoped) remonte `403`.
- Email cible : `supabaseAdmin.auth.admin.getUserById(target_user_id)` (GoTrue admin API —
  plus aucun accès `from('auth.users')`).
- `generateLink` inchangé. Suppression de l'import `has_permission` legacy.

### 3.3 Services frontend

- `createUserAccount.js` → `rpc('admin_create_user', ...)`, puis `assign_user_role` (si
  rôle) et `admin_set_user_active(false)` (si statut inactif) inchangés — retour
  `{id,email}`.
- `updateUserActive.js` → `rpc('admin_set_user_active', {p_target_user_id, p_active})`.
- Plus aucun `auth.admin.*` dans le trafic navigateur.

### 3.4 Sidebar « Mon compte »

- `AppSidebar.jsx` créé : composant **générique registry-driven** (mêmes `buildNavigation`
  + `useEffectiveAuthority` que `SuperAdminSidebar`) avec **sous-titre dynamique** dérivé
  de `findNavMatch` → `NAVIGATION_SECTION_SUBTITLES` (Administration / Compte).
- `Profile.jsx` → `<AppSidebar />` pour **tous les rôles** (fin des trois variantes
  codées en dur ; Batterie/Admin candidates restent là où elles sont fonctionnelles :
  `/test` et module Résultats).
- `SuperAdminSidebar.jsx` **inchangé** (contrainte P4.1 : assertions statiques sur sa
  source).
- `src/components/layout/index.js` : export `AppSidebar`.
- Profil : effet de sync `useEffect` → **pattern « adjust state during render »** (règle
  `react-hooks/set-state-in-effect` du linter), imports inutilisés retirés.

---

## 4. Fichiers modifiés / créés

| Fichier | Changement |
|---|---|
| `supabase/migrations/20260921100000_p1_3_4_b_s2_b_phase7_admin_security_fix.sql` | **Créé** — RPC `admin_create_user` + `admin_set_user_active` SECURITY DEFINER (GRANT authenticated / REVOKE anon) |
| `supabase/functions/admin-reset-password/index.ts` | Permission legacy + lookup REST → RPC SECURITY DEFINER + `getUserById` |
| `src/services/auth/users/createUserAccount.js` | `auth.admin.createUser` → `rpc('admin_create_user')` |
| `src/services/auth/users/updateUserActive.js` | `auth.admin.updateUserById` → `rpc('admin_set_user_active')` |
| `src/components/layout/AppSidebar.jsx` | **Créé** — sidebar générique registry-driven (sous-titre dynamique) |
| `src/components/layout/index.js` | Export `AppSidebar` |
| `src/pages/Profile.jsx` | `<AppSidebar />` pour tous les rôles ; ajustement lint |
| `tests/supabase/manual/test_p4_3_phase7_admin_security_fix.js` | **Créé** — test réel JWT (34 assertions) |
| `tests/supabase/manual/test_p4_3_edge_admin_reset_password.js` | **Créé** — smoke edge via Kong (4 assertions) |

Non modifiés : RBAC/RLS/politiques, permissions, rôles, guards, `src/routes/*`, autres
services, `src/lib/theme.js`.

---

## 5. Validation

### 5.1 Tests réels JWT (Supabase local http://127.0.0.1:54321)

`test_p4_3_phase7_admin_security_fix.js` — **34/34 PASS** :

| Groupe | Vérifié |
|---|---|
| D1–D6 | super_admin crée un compte (`admin_create_user`) : email + bcrypt `$2a$10$` + email confirmé + profil prénom/nom/status + rôle candidate auto + **connexion réelle au compte créé** (compatibilité GoTrue). |
| E1–E2 | candidate **refusée** : `admin_create_user` (users.manage) et `admin_set_user_active` (users.edit). |
| F1–F8 | ban/unban : `banned_until` + `profiles.status` synchronisés, cible inexistante → `UTILISATEUR_INEXISTANT`, **anonyme refusé** (pas d'EXECUTE). |
| G1–G14 | CRUD catalogues via REST : INSERT/UPDATE/DELETE `roles`/`pages`/`features` super_admin OK (**RLS structurelle**), candidat refusé ; `role_permissions` SELECT = 0 ligne pour candidat sans `rbac.role_permissions` (capacité effective). |
| S1–S3 | **statique** : `createUserAccount`/`updateUserActive` routés vers les RPC (plus de `auth.admin.*`) ; edge passe par le RPC (plus de `from('auth.users')` ni `has_permission`). |

`test_p4_3_edge_admin_reset_password.js` — **4/4 PASS** : edge serve par Kong
(http://127.0.0.1:54321/functions/v1/admin-reset-password) : super_admin → 200 ; candidate →
403 ; cible inexistante → 403 ; token invalide → 401.

### 5.2 Régressions

| Suite | Résultat |
|---|---|
| **P4.1** navigation super admin (assertions statiques SuperAdminSidebar incluses) | **32/32 PASS** |
| **P4.2** actions utilisateurs / capacités effectives | **55/55 PASS** |
| **P4.2b** signature `onRoleChange(userId, roleId, add)` | **22/22 PASS** |
| **P4.2c** stabilisation frontend (i18n + stats dashboard) | **17/17 PASS** |
| **P3 S6** promotions / **P3 S7** accès routes / **P3 S9-A** test-route / **P3 S9-B** mode-test | **9/9, 10/10, 14/14, 16/16 PASS** |
| **P3 S10** D1–D7 (profiles, user_roles, catalogues) | **31/31 PASS** |
| **Phase 3** | **17/17 PASS** |
| **Phase 4** | **18/18 PASS** |
| **P4.3** (nouveau) + edge | **34/34 + 4/4 PASS** |

### 5.3 Build / lint

- `npm run build` : ✅ OK (avertissement chunk > 500 kB pré-existant, hors périmètre).
- `npx eslint` fichiers modifiés + nouveaux tests (`Profile`, `AppSidebar`, `layout/index`,
  `createUserAccount`, `updateUserActive`, 2 tests) : ✅ **aucune erreur**.
- Dette eslint pré-existante hors périmètre (test_*.js legacy, `AdminUsers`,
  `SuperAdminAccounts`, contextes, etc.) : **inchangée**, non comptabilisée comme
  régression (présente avant P4.3).

---

## 6. Points hors périmètre (délibérément non traités)

- **Aucune refonte RBAC** : pas de nouvelle permission, pas de nouveau rôle, pas de
  changement de politique RLS (vérifié : écritures catalogues déjà structurellement
  super_admin via `roles_manage_super_admin`/`pages_manage_super_admin`/
  `features_manage_super_admin`).
- `admin_reset_user_password` (phase 6) : réutilisée, non modifiée.
- Sidebar candidat/admin dans `/test` et module Résultats : **conservées** (fonctionnelles
  dans leur contexte).
- `SuperAdminSidebar.jsx` : intact (contrainte d'assertions P4.1).
- Dette eslint pré-existante et avertissement de chunk : chantiers séparés.
- `src/lib/theme.js` non touché.

---

## 7. Décision

✅ **P4.3 VALIDÉE — READY_FOR_NEXT** — les actions « Créer un compte » et
« Activer/Désactiver » sont désormais protégées et fonctionnelles côté navigateur (RPC
SECURITY DEFINER grantés à `authenticated` avec autorité effective `users.manage`/
`users.edit`), l'edge `admin-reset-password` réapplique l'autorité GRANT scoped et lit la
cible via GoTrue admin, et la sidebar « Mon compte » est cohérente pour tous les rôles
(registry + autorité effective). Tests réels JWT 34/34 + edge 4/4, régressions intégrales
au vert, build + eslint propres sur les fichiers modifiés. **STOP** après P4.3 (respect des
consignes).