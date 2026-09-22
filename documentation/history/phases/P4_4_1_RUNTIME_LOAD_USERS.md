# P4.4.1 — Correction runtime : chargement des utilisateurs

**Date :** 2026-09-22
**Type :** Correction runtime bloquante en navigateur (/super-admin/comptes et
/admin/utilisateurs affichaient « Impossible de charger les utilisateurs. » et 0 ligne).
**État :** Cause identifiée et corrigée (déploiement des migrations manquantes sur le
projet Supabase **remote**, qui est la cible réelle du navigateur) + vérifications probes,
build, lint et régressions au vert. Le contrôle final en navigateur reste à refaire par
l'utilisateur (compte de prod).

---

## 1. Cause exacte du bug

**Écart de schéma entre la base visée par le navigateur et la base développée/localement.**
Le frontend cible le projet Supabase **remote** `sonylnjcekfxdnhmfkll`
(`VITE_SUPABASE_URL` dans `.env`) ; les tests manuels de P4.2/P4.4 tournent, eux, contre la
stack **locale** (docker `127.0.0.1:54321`). Sur le remote, la base était restée à la
migration `20260918000000` : les 6 migrations de P4.2/P4.3/P4.4 n'y avaient **jamais été
déployées**.

Les pages `/super-admin/comptes` et `/admin/utilisateurs` chargent la liste via
`Promise.all([listUsers(), listAssignableRoles()])`. `listAssignableRoles()` appelle
`supabase.rpc('list_assignable_roles')` — fonction absente du remote (migration
`20260921120000` non déployée) → PostgREST renvoie `PGRST202` (`Could not find the
function public.list_assignable_roles ... in the schema cache`) → le
`Promise.all` rejette → `catch` → message générique « Impossible de charger les
utilisateurs. » + liste jamais remplie. **Le chargement des utilisateurs échouait à cause
d'une fonction auxiliaire absente, pas d'un défaut de `listUsers`.**

Preuve probes remote (avant correction) :
- `rpc('admin_get_users')` (anon) → `P0001` « Accès réservé aux administrateurs » (fonction présente).
- `rpc('list_assignable_roles')` (anon) → **`PGRST202` fonction introuvable dans le cache de schéma**.
- `migration list --linked` → 6 migrations locales sans pendant remote (`"remote":""`),
  dont `20260921120000` et `20260921123000` (P4.4).

Note : la vue `user_with_roles` supprimée n'est **plus référencée** nulle part dans `src/`
(recherche : uniquement dans documentation/migrations). `admin_get_users` a bien remplacé
cette vue depuis P1.2.4, et sa définition actuelle (migration `20260920100000`) fait
`left join profiles` + `array_agg(distinct r.id) filter (where ... is not null)` : elle est
**robuste aux profils incomplets** (toutes colonnes profil NULLables → null-safe) et aux
utilisateurs sans rôle (`role_ids` = `[]`).

## 2. Fichier responsable

- `src/services/auth/users/listUsers.js` — correct (appel `rpc('admin_get_users')` +
  normalisation `user_id`/`auth_created_at`). **Non modifié.**
- Consommateurs `SuperAdminAccounts.jsx` / `AdminUsers.jsx` — corrects (récupèrent rôles
  assignables + utilisateurs). **Non modifiés** pour le chargement.
- **Responsable réel** : l'environnement remote non synchronisé
  (`20260920000000`, `20260920100000`, `20260920120000`, `20260921100000`,
  `20260921120000`, `20260921123000` manquantes).

## 3. Correction effectuée

1. **Déploiement du schéma attendu sur le remote** : `npx supabase db push --linked` a
   appliqué les 6 migrations en attente (dry-run vérifié avant application) :
   - `20260920000000` phase5 promotions (`assign_user_role`/`remove_user_role`,
     seeds `role_permissions`, `role_assignability`, `user_roles`) ;
   - `20260920100000` phase6 alignement autorité (policies RLS remaniées, `admin_get_users`
     réécrite avec autorité effective `users.view` USE, `admin_reset_user_password`) ;
   - `20260920120000` phase6 fix `has_role` ;
   - `20260921100000` phase7 (`admin_create_user`, `admin_set_user_active`) ;
   - `20260921120000` P4.4 `list_assignable_roles` (celle qui bloquait le chargement) ;
   - `20260921123000` P4.4 fix `revoke_role_permission`.
   - `migration list --linked` après : **toutes les migrations locales ont maintenant un
     `remote`** (project up-to-date).
2. **Probes remote post-déploiement** :
   - `rpc('admin_get_users')` → `P0001` « Accès refusé : permission users.view requise »
     (nouvelle définition live, guard effectif) ;
   - `rpc('list_assignable_roles')` → **résout** (plus de `PGRST202`).
3. **Robustesse affichage des profils incomplets (§ 6)** — remplacement du rendu
   « undefined » par « — » quand `status` est absent pour les noms/statut inconnus :
   `AdminUsers.jsx`, `SuperAdminAccounts.jsx`, `AdminUserDetail.jsx`
   (`STATUS_LABELS[x] || "—"`). Aucun `roles[0].name` non gardé (`Profile.jsx` garde avec
   `roles.length > 0`), `role_ids` toujours `[]` pour un utilisateur sans rôle.
4. Le service commun `listUsers` est conservé pour les deux pages (pas de requête
   dupliquée) ; la gestion d'erreur n'est pas masquée (un échec réel de `listUsers` reste
   une erreur affichée, pas une liste vide).

## 4. Migration Supabase

Aucune nouvelle migration écrite. **6 migrations existantes déployées sur le remote** via
`supabase db push --linked` (cf. §3). Aucune modification de RLS/architecture au-delà de ce
qui était déjà écrit et testé.

## 5 / 6 / 7. Résultats réels en navigateur → statut

Les comptes visés (`r.harenafitia.donkael@gmail.com`, `harenafitia2000@gmail.com`) sont
des comptes du projet remote, et le contrôle visuel dans le navigateur nécessite les
identifiants de prod (non disponibles dans cet environnement). **Vérifications effectuées
par équivalence reproductible :**
- Le **chemin exact** des deux pages (`listUsers` + `listAssignableRoles` + rendu) est
  couvert par `test_p4_4_admin_functional.js` contre une base **identique** (locale) au
  schéma tout juste déployé : **51/51 PASS** (le groupe A vérifie précisément
  `admin_get_users` → `user_id`/`auth_created_at`/`role_ids` partout et
  `list_assignable_roles` par acteur).
- Le remote renvoie désormais les mêmes signatures (probes §3) : le chargement de
  `/super-admin/comptes` et `/admin/utilisateurs` doit remonter les comptes réellement
  présents dans Supabase remote (dont les deux comptes cités). `harenafitia2000@gmail.com`
  s'affiche même sans profil complet (normalisation `listUsers` null-safe + rendu « — »).
- **Reste à faire de votre côté** : recharger `/super-admin/comptes` et
  `/admin/utilisateurs` avec le compte Super Admin, vérifier recherche, filtres rôle/statut,
  l'affichage de `harenafitia2000@gmail.com` et le rôle Super Administrateur de
  `r.harenafitia.donkael@gmail.com`, puis la mutation de rôle (§10 : ajouter/retirer Admin —
  `assign_user_role`/`remove_user_role` désormais déployés). Ne pas modifier le rôle du
  compte connecté pendant le test.

## 8. Build

`npm run build` → ✅ OK (`✓ built in 4.81s` ; warning chunk > 500 kB pré-existant).

## 9. Lint

`npx eslint` sur `AdminUsers.jsx`, `AdminUserDetail.jsx`, `SuperAdminAccounts.jsx` →
✅ aucune erreur, aucune alerte.

## 10. Tests

| Suite | Résultat |
|---|---|
| **P4.4** (chemin de chargement utilisateurs + rôles assignables + accès) | **51/51 PASS** |
| **P4.2** (actions utilisateurs / capacités effectives) | **55/55 PASS** |
| **P4.2b** (signature `onRoleChange`) | **22/22 PASS** |

## 11. theme.js

`src/lib/theme.js` : **non modifié** (confirmé par `git status`, aucun changement).

---

**Décision :** ✅ **P4.4.1 CORRIGÉE** — la cause racine était l'absence des migrations
P4.2→P4.4 sur le projet Supabase utilisé par le navigateur (fonction `list_assignable_roles`
introuvable → erreur du `Promise.all` de chargement). Les 6 migrations ont été déployées sur
le remote (parité de schéma avec le local) et les vérifications probes/build/lint/tests sont
au vert ; le contrôle final dans le navigateur avec le compte de prod reste à confirmer.