# P4 — Étape 1 : Consolidation navigation Super Admin (Route Registry + autorité effective)

**Date :** 2026-09-21
**Type :** Refactorisation frontend ciblée — navigation uniquement. Aucune migration backend, aucune création de permission, aucune modification de guard.
**État :** Rapport final. Validation complète : 130/130 PASS.

---

## 1. Objet

Consolider la navigation de l'espace Super Admin pour qu'elle **consomme réellement le
Route Registry + l'autorité effective** (`ApplicationLayout` + `Sidebar` +
`buildNavigation()` + `useEffectiveAuthority`), et non des liens statiques codés en dur.

Périmètre strict : **navigation uniquement**.
- Aucune modification Supabase / RLS / RPC / modèle RBAC.
- Aucune permission inventée pour afficher des routes.
- Guards conservés tels quels (défense secondaire).
- Labels, icônes, sections, URLs et contexte « Super Admin » conservés.
- Profile / TestApp / AdminResultats / AdminUsers / ModeTest : **composants non refactorisés** (seuls leurs points de consommation changent).

---

## 2. État avant / après

### Avant
- Groupe `superAdmin` du registre **utilisait déjà** `ApplicationLayout` (Sidebar +
  `buildNavigation`) → les pages `/super-admin/*` étaient déjà alignées.
- **`SuperAdminSidebar.jsx`** définissait une liste statique `NAV_ITEMS`
  (Vue d'ensemble, Comptes, Rôles, Accès, Pages, Fonctionnalités + Résultats),
  utilisée par `Profile.jsx` (`/compte` super admin) et `TestApp.jsx` (`/test`
  super admin, desktop + drawer mobile).
- Les routes enfants du groupe superAdmin **ne déclaraient pas leur `guard`**
  dans le registre (seul le groupe le portait) → la couche de navigation ne pouvait
  pas faire le repli guard route-par-route pour ces enfants.

### Après
- **`SuperAdminSidebar.jsx` réécrit en wrapper registry-driven** : il importe
  `routes` du registre, construit les items via
  `buildNavigation(routes, { user, isAdmin, hasRole, canPermission: can })`
  avec `useEffectiveAuthority`, et délègue le rendu au composant `Sidebar`
  partagé (sections + labels + UserAvatar) — mêmes `NAVIGATION_SECTION_LABELS`
  que `ApplicationLayout`.
- Constantions de sections centralisées dans `src/routes/navigation/index.js`
  (`NAVIGATION_SECTION_LABELS`, `NAVIGATION_SECTION_SUBTITLES`) ; `ApplicationLayout`
  les réimporte (source unique).
- Le registre déclare désormais `guard: "superAdmin"` sur les 6 enfants du groupe
  (métadonnée de contrat de navigation — la protection réelle était déjà assurée
  par le guard du groupe).

Conséquence UX : les liens affichés pour un super admin sur `/compte`, `/test` et
`/super-admin/*` sont identiques et **dérivés du registre**. La liste contient
l'intégralité de l'ancienne `NAV_ITEMS` (Vue d'ensemble, Comptes, Rôles, Accès, Pages,
Fonctionnalités, Résultats) **plus** « Utilisateurs » (`results.view`/`users.view`
étaient déjà accordés à super_admin — lien qui manquait dans l'ancienne sidebar).

---

## 3. Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/components/layout/SuperAdminSidebar.jsx` | Réécrit : suppression `NAV_ITEMS` statiques ; consommation `routes` + `buildNavigation` + `useEffectiveAuthority` ; rendu via `Sidebar` partagé |
| `src/routes/navigation/index.js` | Ajout `NAVIGATION_SECTION_LABELS` / `NAVIGATION_SECTION_SUBTITLES` (source unique) |
| `src/components/layout/ApplicationLayout.jsx` | Réimporte les constantes de sections depuis `navigation/index.js` (suppression des constantes locales dupliquées) |
| `src/routes/registry/index.jsx` | Déclaration explicite `guard: "superAdmin"` sur les 6 enfants du groupe (contrat de navigation) |
| `tests/supabase/manual/test_p4_1_navigation.js` | Nouveau test P4.1 (32 assertions) |

Non modifiés (consommateurs inchangés) : `Profile.jsx`, `TestApp.jsx`, `AppShell.jsx`,
`Sidebar.jsx` (générique), `UserAvatar.jsx`, `AdminSidebar.jsx`, `BatterySidebar.jsx`.

---

## 4. Composants encore utilisés / devenus inutiles

- **Toujours utilisés** : `ApplicationLayout`, `Sidebar`, `AppShell`, `UserAvatar`,
  `AdminSidebar` (candidats — fonctionnel), `BatterySidebar` (candidats).
- **`SuperAdminSidebar.jsx`** : conserve son nom et reste branché sur les mêmes points
  (`Profile`, `TestApp`) mais ne génère plus aucun lien statique. Le fichier reste
  nécessaire tant que Profile/TestApp ne basculent pas sur un layout unifié
  (hors périmètre P4.1). **Non supprimé** — vérification manuelle à faire avant toute
  suppression ultérieure (recherche d'import, usages historique).

---

## 5. Cahier des charges de la navigation (vérifié dans le test)

| Règle | Réf. | Statut |
|---|---|---|
| Le Route Registry est la source de vérité des liens | R3 (plus de `NAV_ITEMS`), A, D | ✅ |
| L'autorité effective (permission + capacité) gouverne la visibilité | B, C, D, C2 | ✅ |
| Le rôle n'est **pas** la source de vérité (permission requise même super_admin) | F, B2 | ✅ |
| Routes sans `access` → repli guard (défense secondaire conservée) | F, R2 | ✅ |
| Aucune permission artificielle créée pour afficher une route | R5 (S9-B) | ✅ |
| Aucun UUID hardcodé dans la navigation | E | ✅ |
| Guards (user/admin/superAdmin) toujours mappés | G | ✅ |
| Labels / icônes / sections / URLs conservés | A (11 liens exacts), D | ✅ |
| Contexte Super Admin conservé (subtitle + UserAvatar) | — | ✅ |
| Compte / logout conservés (UserAvatar unifié) | — | ✅ |

---

## 6. Validation

### Tests manuels (Supabase local http://127.0.0.1:54321)

| Suite | Résultat |
|---|---|
| **P4.1** navigation super admin (registre + autorité réelle) | **32/32 PASS** |
| P3 S7 routes super admin / autorité effective | 10/10 PASS |
| P3 S9-A /test → assessment.take | 14/14 PASS |
| P3 S9-B /admin/mode-test/:id → results.view | 16/16 PASS |
| P3 S10 D1–D7 alignement autorité effective | 31/31 PASS |
| Phase 4 RBAC (A–R) | 18/18 PASS |
| P3 S6 promotions | 9/9 PASS |
| **Total** | **130/130 PASS** |

### Build / lint
- `npm run build` : ✅ OK (avertissement chunk > 500 kB pré-existant, hors périmètre).
- `npx eslint` sur les fichiers modifiés : ✅ 0 erreur.
- Dette eslint pré-existante **non traitée** (hors périmètre, pas de refonte) :
  `Profile.jsx` (`MapPin`/`FileJson`/`isAdmin` inutilisés, setState dans effect),
  `AdminUsers.jsx`, `AdminResultats.jsx`, `TestApp.jsx` (warnings deps).

### Smoke (à exécuter au prochain démarrage manuel)
`/super-admin`, `/super-admin/acces`, `/super-admin/comptes`, `/super-admin/roles`,
`/admin`, `/admin/utilisateurs`, `/test`, `/compte` — navigation identique côté
utilisateur, seule la source des liens change.

---

## 7. Points restants / recommandations

- **Suppression éventuelle de `SuperAdminSidebar.jsx`** : possible une fois
  Profile/TestApp passés sur un layout unifié (roadmap frontend D2/D1) — à faire
  avec vérification manuelle, hors P4.1.
- L'entrée « Utilisateurs » s'affiche désormais aussi pour super_admin (cohérente
  avec son autorité `users.view`) — nouveau lien par rapport à l'ancienne sidebar,
  résultat attendu de la densité du registre.
- Dette eslint sur `Profile/TestApp/AdminUsers/AdminResultats` : à adresser dans le
  chantier de refonte globale, pas ici.

---

## 8. Décision

✅ **P4.1 VALIDÉE - READY_FOR_NEXT** — navigation Super Admin entièrement pilotée par
le Route Registry + autorité effective, sans changement de comportement métier,
sans backend ni guard modifié. STOP sur la refonte globale (respect consignes).