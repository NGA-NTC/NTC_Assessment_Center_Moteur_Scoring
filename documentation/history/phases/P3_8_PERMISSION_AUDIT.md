# P3 — Étape 8 : Audit des permissions manquantes

**Date :** 2026-09-20
**Type :** Audit documentaire pur — aucune modification de code, ni migration, ni seed.
**État :** Rapport final. Aucun travail sur l'étape P3.9 commencé.

---

## 1. Objet

Inventorier les permissions du RBAC NTC face aux fonctions métier réelles de
l'application (routes, navigation, pages, services, RPC, RLS), identifier ce qui
manque réellement, et classifier les écarts selon les classes A–E.

Cet audit **ne tranche aucune implémentation** : il produit des signaux et des
recommandations hiérarchisées. Aucune permission n'est créée sur la seule
existence d'une route ou d'une page.

---

## 2. Méthode et sources

| Source | Élément relevé |
|---|---|
| Base locale (Postgres Supabase via psql) | Catalogue des permissions, matrice rôle×permission×capacité, politiques RLS (`pg_policies`) |
| `supabase/migrations/*.sql` | RPC (`assign_user_role`, `revoke_user_role`, `grant_role_permission`, `revoke_role_permission`, `set_role_assignability`, `create_*_delegation`, `revoke_*_delegation`, `has_role`, `has_permission`, `has_role_effective`, `has_effective_capability`, `get_effective_authority`, `admin_get_users`, `admin_reset_user_password`, `bootstrap_super_admin`) |
| `src/routes/registry/index.jsx` | Déclarations `guard`/`access` de toutes les routes |
| `src/routes/navigation/index.js` | `resolveAccess` / repli `guardAllows` |
| Grep `src/**` | Usage `hasPermission` / `hasRole` / `isAdmin` / `supabase.from()` / `supabase.rpc()` |
| `src/services/**` | Services appelés par chaque page |

**Exclusions :** rôles de test (`p3s6_*`, `p3s7_access_role`) non représentatifs du
modèle — la matrice ci-dessous ne couvre que `super_admin`, `admin`, `candidate`.

**Rappel de périmètre :** on ne raisonne jamais « route = permission » ; on raisonne
par fonction métier. `role`, `hierarchy_level`, `is_assignable` ne sont pas des
permissions. Toute capacité non représentable par une permission existante impose
de conserver le guard de rôle actuel.

---

## 3. Catalogue des permissions existantes (16)

| # | Permission | Type | Rôles porteurs (USE) |
|---|---|---|---|
| 1 | `assessment.evaluate` | action | admin, super_admin |
| 2 | `assessment.take` | action | candidate, admin, super_admin |
| 3 | `profile.edit` | action (profil) | candidate, admin, super_admin |
| 4 | `profile.view` | lecture (profil) | candidate, admin, super_admin |
| 5 | `rbac.role_assignability` | admin-capability | admin (tttt), super_admin (tttt) |
| 6 | `rbac.role_delegations` | admin-capability | super_admin (tttt) |
| 7 | `rbac.role_permissions` | admin-capability | super_admin (tttt) |
| 8 | `rbac.user_delegations` | admin-capability | super_admin (tttt) |
| 9 | `reports.view` | lecture (dormante) | admin, super_admin |
| 10 | `results.view` | lecture | admin, super_admin |
| 11 | `users.change_role` | action | admin, super_admin |
| 12 | `users.edit` | action | admin, super_admin |
| 13 | `users.manage` | action | admin, super_admin |
| 14 | `users.promote_admin` | action (promotion) | super_admin (ttt-f) |
| 15 | `users.promote_super_admin` | action (promotion) | super_admin (ttt-f) |
| 16 | `users.view` | lecture | admin, super_admin |

**Absents du catalogue :** aucune permission `pages.*`, `features.*`, `rbac.roles`,
ni `dashboard.*`. Aucune permission sur le passage du test proprement dit.

---

## 4. Matrice des capacités par rôle (état réel base)

### super_admin
| Permission | USE | MANAGE | GRANT | DELEGATE |
|---|---|---|---|---|
| assessment.* (evaluate/take), profile.*, reports.view, results.view | t | f | f | f |
| rbac.role_assignability / role_delegations / role_permissions / user_delegations | t | t | t | t |
| users.change_role | t | t | t | t |
| users.edit | t | t | t | t |
| users.manage | t | f | f | f |
| users.promote_admin / promote_super_admin | t | t | t | f |
| users.view | t | t | t | t |

### admin
| Permission | USE | MANAGE | GRANT | DELEGATE |
|---|---|---|---|---|
| assessment.evaluate/take, profile.edit/view, reports.view, results.view | t | f | f | f |
| rbac.role_assignability | t | t | t | t |
| users.change_role | t | t | t | t |
| users.edit / users.manage / users.view | t | f | f | f |
| rbac.role_permissions / role_delegations / user_delegations, users.promote_* | — | — | — | — (non accordées) |

### candidate
| Permission | USE |
|---|---|
| assessment.take, profile.edit, profile.view | t |

---

## 5. État des RLS (relevé `pg_policies`)

| Table | Accès SELECT | Accès ÉCRITURE |
|---|---|---|
| `permissions` | tous (true) | has_role(admin) ⁄ has_role(super_admin) |
| `pages` / `features` / `page_features` *(vu P3.7)* | mixte | has_role(admin) ⁄ has_role(super_admin) |
| `roles` | tous (true) | has_role(admin) ⁄ has_role(super_admin) |
| `role_permissions` | super_admin uniquement | via RPC security definer uniquement |
| `role_assignability` / `role_delegations` / `user_delegations` | super_admin (own pour user_delegations) | super_admin uniquement |
| `profiles` | own / admin / super_admin | own (sans vérif. permission) / admin / super_admin |
| `user_roles` | own / admin / super_admin | INSERT/DELETE : has_role(admin|super_admin) **et** has_permission(`users.change_role`) |

---

## 6. Matrice métier → permission (DÉTAIL)

| # | Fonction métier | Route / page | Permission existante | Capability | Scope | Suffisant ? | Permission candidate |
|---|---|---|---|---|---|---|---|
| 1 | Se connecter / gérer session | `/connexion`, `/login`, `/inscription`, mot de passe oublié/réinit. | — (accès public) | — | — | Oui | Aucune — accès pré-authentification |
| 2 | Passer le test (candidat) | `/test` (TestApp) | `assessment.take` (USE) | USE | global | Partiel (voir 7-10, D9) | `assessment.take` USE pour l'`access` de la route (décision P3.9) |
| 3 | Consulter son profil | `/compte` | `profile.view` | USE | global | Oui (UI) — RLS sans check (D3) | Aucune |
| 4 | Modifier son profil | `/compte` (édition) | `profile.edit` | USE | global | Oui (UI) — RLS sans check (D3) | Aucune |
| 5 | Résultats admin | `/admin` (AdminResultats) | `results.view` | USE | global | Oui (déjà déclaré) | Aucune |
| 6 | Gestion des utilisateurs (admin) | `/admin/utilisateurs` | `users.view` (nav) + `users.change_role` (attribution UI) | USE / GRANT | global | Oui (déjà déclaré) | Aucune |
| 7 | Créer un compte / attribuer un rôle | `/admin/utilisateurs`, `/super-admin/comptes` | `users.change_role` (backend GRANT via `assign_user_role`) | GRANT | user cible | Oui | Aucune |
| 8 | Promouvoir en admin | `/super-admin/comptes` | `users.promote_admin` (GRANT) | GRANT | user cible | Oui (étape 6) | Aucune |
| 9 | Promouvoir en super_admin | `/super-admin/comptes` | `users.promote_super_admin` (GRANT) | GRANT | user cible | Oui — limitation connue : bloqué par `role_assignability_no_self_assign_check` (création super_admin = `bootstrap_super_admin` uniquement) | Aucune |
| 10 | Mode test (admin) | `/admin/mode-test/:id` | `results.view` / `assessment.take` | USE | global | Repli guard `admin` (aucun `access` déclaré) — acceptable | `assessment.take` USE (option P3.9) |
| 11 | Vue d'ensemble Super Admin | `/super-admin` | aucune | — | — | Guard de rôle suffisant | Aucune (`dashboard.*` non justifié) |
| 12 | Comptes Super Admin | `/super-admin/comptes` | `users.view`, `users.change_role`, promote_* | USE/GRANT | global + user | Oui (backend effectif) | Aucune |
| 13 | Gestion des rôles (catalogue) | `/super-admin/roles` | aucune module `rbac.roles` (n'existe pas) | — | — | Guard de rôle suffisant | `rbac.roles` MANAGE **si** on veut un modèle permissionnel (voir D1) |
| 14 | Gestion des accès / permissions rôles | `/super-admin/acces` | `rbac.role_permissions` | MANAGE | global | **Oui — migré étape 7** (backend exige GRANT effectif) | Aucune |
| 15 | Gestion des pages | `/super-admin/pages` | aucune `pages.*` (n'existe pas) | — | — | Guard de rôle suffisant | `pages.*` **si** modèle permissionnel (voir D1) |
| 16 | Gestion des fonctionnalités | `/super-admin/fonctionnalites` | aucune `features.*` (n'existe pas) | — | — | Guard de rôle suffisant | `features.*` **si** modèle permissionnel (voir D1) |
| 17 | Config. assignabilité rôles | pas d'UI dédiée (backend `set_role_assignability`) | `rbac.role_assignability` | DELEGATE | global | Backend Oui ; **grant admin incohérent** (D7) | Aucune |
| 18 | Délégations de rôles | pas d'UI dédiée | `rbac.role_delegations` | DELEGATE | global | Backend Oui | Aucune |
| 19 | Délégations utilisateur | pas d'UI dédiée | `rbac.user_delegations` | DELEGATE | global | Backend Oui | Aucune |
| 20 | Utilisateurs dormantes | — | `reports.view`, `users.edit`, `users.manage` | USE | global | Permissions accordées mais aucun usage ni enforcement | Aucune (réserve) |

---

## 7. Classification A–E

### A — Permission existante suffisante
1. Résultats admin → `results.view` (migré, UI + navigation).
2. Utilisateurs admin → `users.view` + `users.change_role` (migré).
3. Création compte / attribution rôle → `users.change_role` (GRANT, backend sécurité).
4. Promotions → `users.promote_admin`, `users.promote_super_admin` (étape 6).
5. Accès / permissions rôles → `rbac.role_permissions` MANAGE (**migré étape 7**).
6. Définition profil → `profile.view` / `profile.edit` (usage UI).

### B — Permission potentiellement nécessaire (à trancher en P3.9)
1. **`assessment.take` USE pour l'accès à `/test`** — seule permission existante qui
   représente correctement « peut passer le test ». Aujourd'hui la route est en
   repli `{ type: "user" }` et la logique d'orientation est par rôle dans `TestApp`
   (D9). Justification métier : pouvoir à terme délégner / retirer le droit de
   passer le test sans toucher au rôle.
2. *(Optionnel, lié D1)* création `rbac.roles`, `pages.*`, `features.*` si l'on
   décide de passer les catalogues sur le modèle permissionnel. **Non nécessaire
   aujourd'hui** — aucune fonction métier ne l'exige ; le guard de rôle reste
   approprié en l'état (C).

### C — Guard de rôle encore approprié (aucune permission adéquate)
1. Vue d'ensemble Super Admin (`/super-admin`) — tableau de bord réservé.
2. Rôles (`/super-admin/roles`) — pas de permission `rbac.roles`.
3. Pages (`/super-admin/pages`) — pas de permission `pages.*`.
4. Fonctionnalités (`/super-admin/fonctionnalites`) — pas de permission `features.*`.
5. Mode test admin (`/admin/mode-test/:id`) — repli guard `admin` accepté.
6. Comptes Super Admin (`/super-admin/comptes`) — la page reste super_admin (guard
   de rôle), les opérations étant elles-mêmes verrouillées par RPC/permissions.
7. Délégations (rôles/utilisateur) et assignabilité — pas d'UI, backend suffisant.

### D — Problèmes de sécurité / divergence à traiter (SIGNAL SEULEMENT)
> Identifiés et décrits, **aucune correction** dans cette étape (P3.9 et suivantes).

| # | Divergence | Détail |
|---|---|---|
| D1 | **RLS catalogues basée rôle, pas permission** | `roles`, `pages`, `features`, `permissions` : écriture via `has_role(admin) ⁄ has_role(super_admin)` et **lecture page fonction de la table** ; l'UI est super_admin-only (guard). Résultat : `admin` peut écrire ces catalogues **directement via REST** sans passer le modèle permissionnel — compensation actuelle = guards UI uniquement. |
| D2 | `admin_get_users` basé rôle | RPC exposée à authenticated, vérifie `admin`/`super_admin` par rôle, pas `users.view`/`users.manage`. |
| D3 | `profiles` : auto-édition sans permission | `profiles_update_own` n'applique aucune vérification `profile.edit` → permission non enforceable côté backend. |
| D4 | Double niveau RLS vs RPC (USE vs GRANT) | `user_roles` INSERT/DELETE exige `has_permission('users.change_role')` (= USE) alors que `assign/revoke_user_role` exigent **GRANT** ; un rôle doté de rôle admin + USE `users.change_role` (sans GRANT) pourrait écrire `user_roles` directement. Non exploitée aujourd'hui (admin détient USE+GRANT) mais modèle incohérent. |
| D5 | Lecture `role_permissions` super_admin-only | RLS SELECT brièvement super_admin ; si `rbac.role_permissions` était accordée à d'autres, lecture bloquée malgré le grant. |
| D6 | `has_role`/`has_permission` ignorent les délégations | Les politiques RLS encore rôle-based ne voient pas les délégations ; seul le chemin effectif (`has_role_effective`, `has_effective_capability`) les prend en compte. |
| D7 | Grant `rbac.role_assignability` sur `admin` incohérent | `admin` a (USE/MANAGE/GRANT/DELEGATE) mais la table `role_assignability` est super_admin-only → accès mort (ni lecture ni écriture). |
| D9 | `/test` en repli `{ type: "user" }` | La nav affiche « Passer le test » pour **tout** utilisateur authentifié même sans `assessment.take` ; la logique d'orientation dans `TestApp` est par rôle (`hasRole`). |

### E — Problèmes UX à traiter (SIGNAL SEULEMENT)
| # | Élément |
|---|---|
| E1 | Lié D9 : cohérence nav/état réel — un utilisateur sans `assessment.take` voit le menu test. |
| E2 | Création d'un super_admin impossible via UI (limitation assignability) — message/parcours actuel : non documenté côté utilisateur (bootstrap service uniquement). |
| E3 | Pages/fonctionnalités/roles : aucune indication d'autorisation insuffisante si un rôle non-super_admin accède plus tard (repli guard silencieux). |

---

## 8. Analyse des risques transverses

1. **Chaîne de promotion (déjà verrouillée, étape 6)** : `PROMOTION_INTERDITE`
   avant `role_assignability` → préserve Phase 4 C ; `revoke_user_role` volontairement
   asymétrique (préservation Phase 4 R). Aucun chemin super_admin→super_admin en UI :
   **point unique d'administration** = `bootstrap_super_admin` (révoqué pour
   authenticated/anon). À documenter dans l'exploitation.
2. **Surface RPC exposée à authenticated** : toutes les RPC sécurité (assign,
   grant, delegations, authority) sont `security definer` avec checks
   d'autorité effective internes — le modèle RPC est le **vrai garde-fou
   backend**, l'UI n'étant qu'UX.
3. **Double système RLS (rôle) / permission (RPC)** : tant que les tables
   catalogue restent gouvernées par RLS rôle, la permissionnalisation UI
   (navigation) et le guard de rôle coexistent par défense en profondeur — c'est
   l'état actuel assumé ; l'écart est D1/D4.
4. **`get_effective_authority` exposée à anon** : renvoie les flags de l'utilisateur
   courant — pas de donnée sensible, mais à surveiller (pas de fuite d'autorisations
   d'autrui).

---

## 9. Synthèse et suites recommandées (pour P3.9+, NON implémentées ici)

1. **Priorité sécurité (traitement indépendant)** : aligner RLS sur le modèle
   permissionnel pour `roles`/`pages`/`features`/`permissions` (D1), harmoniser
   USE/GRANT sur `user_roles` (D4), lever l'incohérence D7 (retirer
   `rbac.role_assignability` de `admin` ou ouvrir l'accès).
2. **Priorité fonctionnelle (décision P3.9)** : déclarer `assessment.take` USE pour
   l'`access` de `/test` (+ éventuellement `/admin/mode-test/:id`) — c'est la seule
   permission existante représentant correctement cette fonction (B1).
3. **Conserver en l'état (C)** : dashboard, roles, pages, fonctionnalites,
   comptes — aucune permission adéquate, guard de rôle justifié.
4. **Ne PAS créer** de permissions `pages.*`/`features.*`/`rbac.roles` sans décision
   d'alignement RLS (inutiles si la table reste gouvernée par rôle).

**Conclusion de l'étape :** l'audit ne révèle **aucune fonction métier bloquée**
par une permission manquante. Les rouages critiques (attribution, promotion,
permissions rôles, délégations, autorité effective) sont opérationnels. Les écarts
sont des divergences d'architecture (D) et une UX (E), à traiter hors cadre de cet
audit pur. Fin de l'étape 8 — aucune suite engagée.

---

## 10. Vérifications

- `git diff` : aucun changement fonctionnel (seul ce fichier de documentation est
  ajouté). ✔
- Aucune migration, seed, fichier `src/**`, test ou configuration modifié par
  l'étape 8. ✔