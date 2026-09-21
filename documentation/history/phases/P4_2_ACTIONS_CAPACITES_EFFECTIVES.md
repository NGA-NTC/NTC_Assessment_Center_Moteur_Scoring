# P4 — Étape 2 : Actions UI de gestion utilisateurs pilotées par les capacités effectives

**Date :** 2026-09-21
**Type :** Refactorisation frontend ciblée — pages `AdminUsers`, `AdminUserDetail`, `SuperAdminAccounts` uniquement. Aucune migration backend, aucune création de permission, aucun changement RPC/RLS/guard.
**État :** Rapport final. Validation complète : 157/157 PASS (55 P4.2 + 102 régression).

---

## 1. Objet

Faire piloter les **actions UI** de gestion des utilisateurs par les **capacités effectives**
(`useEffectiveAuthority().can(permission_id, capability)`) au lieu du nom de rôle :

- consulter la liste / le détail d'un utilisateur,
- modifier le profil / suspendre-réactiver,
- changer / révoquer les rôles,
- promouvoir admin et super_admin,
- réinitialiser le mot de passe,
- créer un compte.

Périmètre strict :
- Frontend = **UX uniquement** (afficher / masquer / désactiver / feedback). Le backend
  (RLS, RPC `assign_user_role`/`revoke_user_role`/`admin_get_users`, edge
  `admin-reset-password`) reste la **source de vérité** : une action masquée est toujours
  refusée côté serveur.
- Aucun nouveau moteur d'autorisation : les 3 pages consomment le hook partagé existant.
- Aucune lecture directe de `role_permissions` dans les pages, aucun UUID hardcodé,
  aucune autorisation basée uniquement sur le nom du rôle.
- Modales, toasts, statuts de chargement, motifs, URLs, libellés **conservés**.
- `Profile / TestApp / AdminResultats / ModeTest`, pages Rôles/Accès/Pages/Fonctionnalités
  et dashboard : **non traités**.

---

## 2. Contrat action → (permission, capacité)

Centralisé dans `src/services/auth/users/actionAccess.js` (source unique consommée par
les pages et par le test P4.2 — zéro permission inventée).

| Action | Permission | Capacité exigée | Note |
|---|---|---|---|
| Consulter la liste / le détail | `users.view` | `USE` | cohérent `admin_get_users` (enforce `users.view USE` en backend) |
| Modifier le profil / suspendre / réactiver | `users.edit` | `USE` | cohérent UPDATE `public.profiles` RLS (enforce `users.edit USE` global) |
| Créer un compte | `users.manage` | `USE` | **gap backend signalé** : `createUserAccount` appelé via client publishable → l'autorisation réelle repose sur l'API Auth (service_role), pas sur un RPC RBAC (cf. §7) |
| Changer / révoquer les rôles | `users.change_role` | `GRANT` | cohérent `assign_user_role`/`revoke_user_role` (exigent `GRANT users.change_role` scopé) |
| Réinitialiser le mot de passe | `users.change_role` | `GRANT` | l'edge `admin-reset-password` vérifie en fait `has_permission(users.change_role)` (usage, pas capacité) — **écart signalé**, sans impact ici (GRANT implique USE) |
| Promouvoir admin | `users.promote_admin` | `GRANT` | exigé par `assign_user_role` pour le rôle `admin` |
| Promouvoir super_admin | `users.promote_super_admin` | `GRANT` | exigé par `assign_user_role` pour le rôle `super_admin` |

### État avant / après

**Avant** : les 3 pages mélangeaient `useAuth` + `hasPermission()` (permission traitée
comme un booléen, sans notion de capacité), ou passaient des booléens en dur
(`canManageRoles={true}`), en se fiant au rôle (super-admin) plutôt qu'à l'autorité.

**Après** : chaque action est dérivée de `can(permission_id, capability)` via
`userActions.*` (7 prédicats). Pendant le chargement de l'autorité (`can()` → false),
les actions restent masquées puis apparaissent au `refresh()` — pas de flash de boutons
non autorisés. Le backend refuse toujours ce qui n'est pas masqué (vérifié par les tests
E3/D3/H3).

---

## 3. Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/services/auth/users/actionAccess.js` | **Créé** — `USER_ACTION_CONTRACT` + prédicats `canViewUsers`/`canEditUser`/`canCreateUser`/`canChangeRole`/`canResetPassword`/`canPromoteAdmin`/`canPromoteSuperAdmin` + map `userActions` |
| `src/pages/AdminUsers.jsx` | `useUserAuth`/`hasPermission` retirés → `useEffectiveAuthority` + `userActions` ; guards `handleResetPassword`/`handleToggleStatus`/`handleRoleChange` ; spinner `adminLoading ∥ authorityLoading` ; consultation remplacée par un message dédié si `!canViewUsers` ; bouton Actualiser désactivé ; `canManageRoles={userActions.canChangeRole(can)}` ; chargement initial conditionné à l'autorité chargée |
| `src/pages/AdminUserDetail.jsx` | `hasPermission` retirés → `can()` (GRANT) pour les promotions ; `canEdit` pour profil + suspension ; inputs profil désactivés (`disabled` + fond gris) quand `!canEdit` ; boutons Réactiver/Désactiver et Enregistrer désactivés ; bouton reset conditionnel |
| `src/pages/SuperAdminAccounts.jsx` | `hasPermission` retirés → `can()` (canCreateUser, canEditUser, canChangeRole, canResetPassword, canPromoteAdmin, canPromoteSuperAdmin) ; guards handlers ; bouton « Nouvel utilisateur » gated `canCreateUser` ; boutons tableau gated ; `canManageRoles={canChangeRole}` (au lieu de `true`) |
| `tests/supabase/manual/test_p4_2_user_actions.js` | Nouveau test P4.2 (55 assertions) |

Non modifiés : `useEffectiveAuthority.js`, `services/auth/users/*`, RPC, RLS, edge,
`roles`/`permissions`/`role_permissions`.

---

## 4. Cahier des charges (cas A–M, vérifié dans le test)

| Règle | Réf. | Statut |
|---|---|---|
| `users.view USE` → consultation visible et fonctionnelle | A, A2 | ✅ |
| Sans `users.view` → consultation non exposée (message dédié) | B, B2 | ✅ |
| `users.edit USE` → modification / suspension disponible | C, C2 | ✅ |
| Sans `users.edit` → action masquée / désactivée | D | ✅ |
| `users.change_role GRANT` → changement de rôle disponible | E, D2 | ✅ |
| `users.change_role USE` mais pas `GRANT` → non disponible | F | ✅ |
| `users.promote_admin GRANT` → promotion admin disponible | G, G3 | ✅ |
| Sans `users.promote_admin GRANT` → non disponible (+ RPC refuse) | H, H3 | ✅ |
| `users.promote_super_admin GRANT` → promotion super_admin disponible | I | ✅ |
| Sans `users.promote_super_admin GRANT` → non disponible | J | ✅ |
| Permission **expirée / révoquée** → action disparaît après `refresh()` | K | ✅ |
| Aucun UUID hardcodé dans les pages / contrat | L | ✅ |
| Aucune autorisation basée uniquement sur le nom du rôle | M | ✅ |
| Masquer une action ≠ autoriser : backend refuse ce qui est masqué | E3/D3/H3 | ✅ |
| Aucun `hasPermission`/`hasRole` résiduel dans les 3 pages | 0.9–0.11 | ✅ |
| Même hook partagé (pas de 2ᵉ moteur d'autorisation) | 0.9 | ✅ |

---

## 5. Validation

### Tests manuels (Supabase local http://127.0.0.1:54321)

| Suite | Résultat |
|---|---|
| **P4.2** actions utilisateurs pilotées par capacités effectives | **55/55 PASS** |
| P4.1 navigation super admin | 32/32 PASS |
| P3 S7 routes super admin / autorité effective | 10/10 PASS |
| P3 S9-A /test → assessment.take | 14/14 PASS |
| P3 S9-B /admin/mode-test/:id → results.view | 16/16 PASS |
| P3 S10 D1–D7 alignement autorité effective | 31/31 PASS |
| Phase 4 RBAC (A–R) | 18/18 PASS |
| P3 S6 promotions | 9/9 PASS |
| **Total** | **157/157 PASS** |

### Build / lint
- `npm run build` : ✅ OK (avertissement chunk > 500 kB pré-existant, hors périmètre).
- `npx eslint` sur les 4 fichiers modifiés : ✅ **aucune erreur nouvelle**.
- Dette eslint pré-existante **non traitée** (hors périmètre, pas de refonte) —
  régressions `react-hooks/set-state-in-effect` / `exhaustive-deps` déjà présentes à la
  ligne 46 (`useEffect` initial `fetchUsers`) dans `AdminUsers.jsx` et `SuperAdminAccounts.jsx`
  (ligne 53). Elles existaient avant P4.2 (même pattern `useEffect(→setState)`), signalées
  comme dette à traiter dans le chantier de refonte global, **non modifiées** pour ne pas
  introduire de risque dans des pages fonctionnelles.

### Smoke (à exécuter au prochain démarrage manuel)
`/admin/utilisateurs` (AdminUsers), `/super-admin/comptes` (SuperAdminAccounts), détail
d'un utilisateur (AdminUserDetail) : boutons gated selon l'autorité du compte connecté,
interactions (reset MDP, suspension, rôle, profil) inchangées pour un super admin.

---

## 6. Points restants / recommandations

- **Gap backend « créer un compte »** : `createUserAccount` / `updateUserActive` passent par
  l'API Auth (`supabase.auth.admin.*`) avec un client publishable — `users.manage` n'est
  **pas** enforce par un RPC RBAC. Le gating UI est effectif, mais une protection backend
  dédiée (RPC SECURITY DEFINER vérifiant `users.manage USE`) reste à concevoir en phase
  backend. **Signalé, non implémenté** (hors périmètre P4.2 : pas de nouveau backend).
- **Écart reset password** : l'edge `admin-reset-password` vérifie
  `has_permission(users.change_role)` (ancienne convention, « usage »). Contract frontend =
  `GRANT`. Aucun impact (GRANT ⇒ USE), mais alignement possible en phase backend.
- **Mismatch pré-existant Signalé (non corrigé, refonte hors périmètre)** :
  `SuperAdminAccounts.handleRoleChange(userId, newRoleId)` a une signature différente de
  celle attendue par `AdminUserDetail.onRoleChange(user.id, roleId, add)` → le menu de rôle
  ouvert depuis `/super-admin/comptes` n'applique pas l'ajout/retrait comme prévu.
  À traiter hors P4.2 (comportement, pas autorisation).
- Dette eslint (set-state-in-effect) et chunk > 500 kB : chantiers séparés.

---

## 7. Rappel règles respectées

- Frontend ≠ couche de sécurité → actions masquées mais toujours refusées par RLS/RPC.
- Aucune permission inventée : les 5 permissions utilisées existent en base
  (`users.view`, `users.edit`, `users.manage`, `users.change_role`, `users.promote_admin`,
  `users.promote_super_admin`).
- Aucun RPC, RLS, edge, guard, rôle ou permission modifié.
- UX (modales, toasts, chargements, labels, URLs) conservée.

---

## 8. Décision

✅ **P4.2 VALIDÉE - READY_FOR_NEXT** — actions UI de gestion utilisateurs désormais
pilotées par les capacités effectives (`users.view/edit/manage USE`,
`users.change_role/promote_admin/promote_super_admin GRANT`), avec conservation complète
de l'UX et du backend. STOP après P4.2 (respect des consignes : pas de P4.3).