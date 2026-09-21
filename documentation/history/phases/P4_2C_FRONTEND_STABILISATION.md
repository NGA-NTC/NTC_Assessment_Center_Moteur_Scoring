# P4.2c — Stabilisation frontend ciblée après smoke test

**Date :** 2026-09-21
**Type :** Stabilisation frontend ciblée — titres i18n + stats du dashboard super admin. Aucune migration, aucun changement RPC/RLS/role/permission/guard. `src/lib/theme.js` non touché.
**État :** Rapport final. Validation complète : 17/17 P4.2c + régressions P4.2 (55/55) et P4.2b (22/22) + build + eslint.

---

## 1. Objet

Après le smoke test manuel du frontend, corriger **uniquement** les problèmes réellement
constatés à l'écran, sans ouvrir un nouveau chantier RBAC :

1. **Titres i18n affichant des clés brutes** sur 3 pages super admin :
   `pages.fonctionnalites.title`, `pages.pages.title`, `pages.accessControl.title`
   (header `ApplicationLayout`, document title).
2. **Dashboard `/super-admin` affichant 0 partout** (utilisateurs, rôles, règles d'accès,
   pages, fonctionnalités, module résultats) alors que les écrans correspondants affichent
   des données réelles.
3. **`/admin/utilisateurs` sans sidebar** : déterminer si intentionnel ou régression de layout.

Contraintes respectées : réutilisation des services existants (aucun second accès direct
Supabase là où un service existe), aucune nouvelle architecture i18n, aucune modification
RBAC/backend, design conservé, dashboard non refondu, URLs/comportements inchangés.

---

## 2. Problèmes constatés et causes racines

### 2.1 Titres i18n en clés brutes

- Les 3 routes super admin (`/super-admin/acces`, `/super-admin/pages`,
  `/super-admin/fonctionnalites`) déclarent `titleKey: "pages.*.title"` dans
  `src/routes/registry/index.jsx`.
- `ApplicationLayout` rend `<h1>{t(activeRoute.titleKey)}</h1>` et `DocumentTitleSync`
  utilise `useDocumentTitle(route?.titleKey)`.
- **Cause racine** : `t()` dans `src/i18n/index.js` faisait un **lookup plat** :
  `localeDict[keyParts.join(".")]` c.-à-d. `frPages["fonctionnalites.title"]`, alors que les
  fichiers `pages.json` sont **imbriqués** (`{ "fonctionnalites": { "title": "…" } }`).
  → `undefined` → retour de la **clé brute**. Toutes les clés `pages.*.title` étaient
  concernées ; seules 3 le montraient au smox test (les autres pages super admin avaient
  leur titre repris par des `PageTitle` en dur).
- **Correction** : lookup **imbriqué** par réduction (`keyParts.reduce(...)`), sans toucher
  au format des fichiers de traduction, ni ajouter de nouvelle architecture. Les
  traductions existantes (`fr` et `en`) sont réutilisées telles quelles. Ajout
  `with { type: "json" }` sur les imports JSON (compatibilité Node + Vite).

### 2.2 Dashboard super admin affichant 0

- **Cause racine** : `getSuperAdminStats.js` faisait
  `supabase.from("role_permissions").select("id", { count: "exact", head: true })`.
  La table `role_permissions` n'a **pas de colonne `id`** (PK = `role_id, permission_id` ;
  colonnes `role_id, permission_id, can_use, can_manage, can_grant, can_delegate`).
  → PostgREST renvoie une erreur → `Promise.all` rejette → le `catch` du dashboard laisse
  tous les totaux à 0, **y compris users/roles/pages/features** pourtant comptables.
- Vérifié en local : `500`/erreur sur `role_permissions.select("id", …)` ; requêtes valides
  (`select("permission_id")` / `role_id`) retournent 56 lignes.
- **Module résultats = 0 fabriqué** : `results: 0` était codé en dur dans
  `SuperAdminDashboard.jsx` ; le module Résultats (`/admin`, `AdminResultats`) est alimenté
  par le **stockage local** (comptes `ntc_users` + imports statiques/dynamiques), pas par
  Supabase — donc non couvert par le service backend.
- **Correction** :
  - `getSuperAdminStats.js` réécrit pour **réutiliser les services existants**
    (`listUsers`, `listRoles`, `listPages`, `listFeatures`, `listRolePermissions`) au lieu
    de requêtes directes. Les 5 compteurs proviennent maintenant de colonnes/sources valides.
  - `results` compté côté frontend avec les mêmes fonctions que `AdminResultats`
    (`listAccounts`, `listImportedResults`, `listImported`, `listHiddenStaticFiles`,
    `buildCandidates`) — pas de nouvel accès Supabase, pas de nouveau service.

### 2.3 `/admin/utilisateurs` sans sidebar

- `AdminUsers.jsx` rend `<AppShell maxWidth={1000} sidebar={<div />}>` : la sidebar est
  **volontairement vide**. La seule sidebar « admin » du projet (`AdminSidebar`) est
  spécifique au module Résultats (liste des candidats) et n'a jamais été utilisée sur la
  page Utilisateurs.
- **Conclusion** : état **intentionnel / historique** — cette structure existe depuis les
  commits d'origine (P1.2/P1.2.4, `814d448`, `eca2f18`), précédant largement P4.x.
  Ce **n'est pas une régression** introduite par P4.2/P4.2b. **Aucun changement effectué**,
  aucune régression de layout à corriger. L'URL et le comportement sont conservés.

---

## 3. Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/i18n/index.js` | `t()` : lookup plat → **imbriqué** (`keyParts.reduce`) ; imports JSON avec `with { type: "json" }` |
| `src/services/dashboard/getSuperAdminStats.js` | Requêtes directes → **services existants** (`listUsers`/`listRoles`/`listPages`/`listFeatures`/`listRolePermissions`) ; colonne invalide `role_permissions.id` supprimée |
| `src/pages/SuperAdminDashboard.jsx` | `results: 0` en dur → **comptage réel** des candidats (`buildCandidates` sur storage local) ; consommation du service `getSuperAdminStats` |
| `tests/supabase/manual/test_p4_2c_frontend_stabilisation.js` | **Créé** — test ciblé P4.2c (17 assertions) |

Non modifiés : `src/routes/registry/index.jsx`, `ApplicationLayout.jsx`, `useDocumentTitle.js`,
`AdminUsers.jsx`, fichiers de traduction, RBAC, RPC, RLS, migrations, guards, `src/lib/theme.js`.

---

## 4. Validation

### Tests manuels (Supabase local http://127.0.0.1:54321)

| Suite | Résultat |
|---|---|
| **P4.2c** stabilisation frontend (titres i18n + forage stats) | **17/17 PASS** |
| **P4.2** actions utilisateurs pilotées par capacités effectives (régression) | **55/55 PASS** |
| **P4.2b** signature `onRoleChange(userId, roleId, add)` (régression) | **22/22 PASS** |

Détail P4.2c :
- Titres : `pages.accessControl.title` → « Accès », `pages.pages.title` → « Pages »,
  `pages.fonctionnalites.title` → « Fonctionnalités », plus `pages.tableauDeBord.title`,
  repli clé inconnue et `t()` sans clé.
- Stats (vs DB locale) : users 131, roles 24, pages 13, features 37, règles d'accès 56 —
  aucune erreur sur `role_permissions`.

### Build / lint

- `npm run build` : ✅ OK (avertissement chunk > 500 kB pré-existant, hors périmètre).
- `npx eslint` sur les 4 fichiers (3 modifiés + 1 test) : ✅ **aucune erreur nouvelle**.
- Dette `react-hooks/set-state-in-effect` pré-existante dans `AdminUsers.jsx` /
  `SuperAdminAccounts.jsx` : **non traitée** (hors périmètre), inchangée.

### Smoke (déjà constaté, non re-corrigé ici)

- `/super-admin` : les 6 cartes affichent maintenant les **totaux réels** (plus de 0) ;
  « Module Résultats » reflète le nombre de candidats du module.
- `/admin/utilisateurs` : sidebar absente = **état volontaire** (voir §2.3), non modifié.

---

## 5. Points hors périmètre (délibérément non traités)

- **Dette eslint** (`set-state-in-effect` / `exhaustive-deps`) dans `AdminUsers.jsx` et
  `SuperAdminAccounts.jsx` — chantier de refonte global, non touché ici.
- **Chunk > 500 kB** (avertissement build) — chantier séparé.
- **Audit RBAC complet / nouveaux permis / nouveau backend** — explicitement exclus.
- Aucune modification des **rôles, permissions, RPC, RLS, migrations, guards**.
- `src/lib/theme.js` non touché.
- Dashboard **non refondu** : seule l'alimentation des chiffres a été corrigée.

---

## 6. Rappel règles respectées

- Réutilisation des services existants (`list*`) — **aucun second accès direct Supabase**
  là où un service existait ; pour le module Résultats (stockage local, sans backend), les
  fonctions déjà utilisées par `AdminResultats` sont réutilisées.
- Aucune nouvelle architecture i18n : correctif minimal du résolveur, fichiers de
  traduction existants conservés.
- URLs, comportements, design, libellés conservés.

---

## 7. Décision

✅ **P4.2c VALIDÉE — READY_FOR_NEXT** — titre i18n réparés (3 clés + toutes les clés
`pages.*.title`), dashboard super admin alimenté avec les totaux réels (dont module
Résultats), sidebar d'`AdminUsers` confirmée intentionnelle donc non modifiée. STOP après
P4.2c (respect des consignes).