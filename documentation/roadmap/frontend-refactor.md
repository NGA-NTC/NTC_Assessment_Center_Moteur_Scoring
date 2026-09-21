---
id: ROADMAP-FRONTEND-REFACTOR-001
title: Roadmap refactorisation frontend
category: roadmap
status: designed
version: 1.0.0
created_at: 2026-09-18
updated_at: 2026-09-18
source_of_truth: true
tags:
  - roadmap
  - refactoring
  - frontend
  - planning
---

# Roadmap — Refactorisation Frontend

> État : **EN ATTENTE DE VALIDATION**. Aucun code de production n'est modifié à ce stade.
> Ce document consolide : inventaire actuel, architecture cible, doublons, renommages, déplacements, fusions, nouveaux modules, ordre des phases.

## 1. Contexte et objectifs

Refactoriser le frontend vers l'architecture cible validée (ADR-004, ADR-005) en respectant :
- AUCUNE modification backend Supabase (pas de table/RPC/RLS).
- Batteries `data/battery*.js` : **non touchées** (migration Supabase future, dette assumée).
- `src/lib/theme.js` : **jamais modifié**.
- Pas de refonte UI.
- i18n **fr / en** uniquement (pas de `mg` maintenant).

## 2. Arbre `src/` actuel (inventaire)

```
src/
├── index.css
├── main.jsx
├── assets/                        # hero.png, react.svg, vite.svg (inutilisés)
├── components/
│   ├── layout/                    # AdminSidebar, AppShell, AuthShell, Sidebar, SidebarFooter, SuperAdminLayout, SuperAdminSidebar, UserAvatar
│   ├── question/                  # CoherenceBattery, InfoCallout, IntensityToggle, McqBattery, OptionButton, QuestionCard, ResponsesReview, RubricBattery, RubricScorer
│   └── ui/                        # Badge, BrandHeader, Button, Card, Field, FilterDropdown, FormCard, ImportJsonButton, PageTitle, PasswordField, ProgressCircle, RowMenu, SearchField
├── context/                       # AdminAuthContext, UserAuthContext
├── data/                          # batteries.js, battery1..8.js, dimensions.js, index.js  (NON MODIFIÉS)
├── lib/                           # candidates.js, export.js, imported.js, scoring.js, storage.js, supabaseClient.js, theme.js
├── pages/                         # AdminResultats, AdminUserDetail, AdminUsers, ChangePassword, ForgotPassword, Login, ModeTest, Profile, Register, ResetPassword, ResultsView, SuperAdminAccess, SuperAdminAccounts, SuperAdminDashboard, SuperAdminFeatures, SuperAdminPages, SuperAdminRoles, TestApp, UserLogin
├── reponses/                      # andrianina.json, example-candidat.json
└── routes/                        # ProtectedRoute.jsx, SuperAdminRoute.jsx, UserRoute.jsx, index.jsx
```

## 3. Arbre `src/` cible

```
src/
├── main.jsx                         # point d'entrée (inchangé dans son rôle)
├── app/                             # AppProviders (Auth + Router + i18n)
├── routes/                          # route registry (route_key → path → composant), RouteGuard, redirections
├── pages/                           # par domaine fonctionnel (auth/, account/, assessment/, results/, administration/)
│   ├── auth/                        #   AuthPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, ChangePasswordPage
│   ├── account/                     #   AccountPage
│   ├── assessment/                  #   TestPage, ModeTestPage
│   ├── results/                     #   ResultsPage
│   └── administration/              #   DashboardPage, UsersPage, AccountsPage, RolesPage, AccessControlPage, PagesPage, FeaturesPage
├── components/
│   ├── atoms/                       # Button, Field, Badge, Card, ProgressCircle, Avatar
│   ├── molecules/                   # PasswordField, SearchField, FormCard, BrandHeader, PageTitle, FilterDropdown, ImportJsonButton, RowMenu, FlashMessage, CRUDModal, ConfirmModal, LoadingScreen
│   ├── organisms/                   # ResultsGrid, AdminResultsTable (nom à confirmer), BatteryNav, CandidateList
│   └── question/                    # (conservé tel quel) McqBattery, RubricBattery, CoherenceBattery, QuestionCard, OptionButton, IntensityToggle, RubricScorer, InfoCallout
├── layouts/
│   ├── ApplicationLayout/           # shell unique (sidebar + header + contenu)
│   ├── AuthLayout/                  # ex-AuthShell
│   └── Sidebar/                     # Sidebar, SidebarLogo, SidebarNavigation, SidebarSection, SidebarNavigationItem, SidebarFooter, SidebarUser
├── hooks/
│   ├── auth/                        # useAuth, useAuthActions
│   ├── rbac/                        # useRoles, usePermissions, useCapabilities
│   ├── navigation/                  # useNavigation, useActiveRoute
│   ├── data/                        # useUsers, useAccounts, useRoles, useResults, usePages, useFeatures
│   └── ui/                          # useMediaQuery, useModal, useFlash
├── contexts/                        # AuthContext, I18nContext, NavigationContext
├── services/
│   ├── auth/                        # session.js, password.js
│   ├── users/
│   ├── roles/
│   ├── rbac/                        # rolePermissions/, roleDelegations/, userDelegations/, roleAssignability/
│   ├── assessments/                 # réponses + scoring persistant
│   ├── results/
│   ├── candidates/                  # (remplace lib/candidates.js)
│   └── import/                      # (remplace lib/imported.js + normalisation de storage.js)
├── lib/                             # supabaseClient.js, theme.js (NON MODIFIÉ), helpers purs
├── data/                            # batteries + dimensions (GARDÉES, non refactorisées)
├── config/                          # env.js (VITE_*)
├── constants/                       # route_keys, slugs rôles UI, ROLE_LABELS (extraits des pages)
├── utils/
│   ├── score/                       # calculateScore.js, normalizeScore.js, validateScore.js, index.js
│   └── format/                      # formatDate, etc.
├── styles/                          # tokens/, globals.css, utilities.css, index.css (Tailwind = système principal)
├── i18n/                            # locales/fr, locales/en, config.js, index.js
└── assets/                          # images/polices (vider les reliquats Vite)
```

## 4. Doublons identifiés (liste complète)

| # | Doublon | Où | Traitement |
|---|---------|----|------------|
| D1 | 3 sidebars quasi identiques | `Sidebar`, `AdminSidebar`, `SuperAdminSidebar` | Fusion en `Sidebar` + `BatteryNav`/`CandidateList` |
| D2 | 2 shells jumeaux | `AppShell` ≈ `SuperAdminLayout` | Fusion en `ApplicationLayout` + `AuthLayout` |
| D3 | Relecture readonly dupliquée | `ResponsesReview` vs `McqBattery`+`RubricBattery`+`CoherenceBattery` (`B7_DIMS`, `B8_OPTS`, `ReadonlyOption`) | Batteries avec prop `readOnly` |
| D4 | Générateur PDF dupliqué + code mort | `lib/export.js#printCandidateReport` (jamais importé) + copie locale dans `AdminResultats` | Une seule source dans `services/export` |
| D5 | 3 guards identiques | `ProtectedRoute`, `SuperAdminRoute`, `UserRoute` | 1 `RouteGuard` + `LoadingScreen` |
| D6 | 2 pages de login miroirs | `Login` ↔ `UserLogin` | Fusion en `AuthPage` |
| D7 | Labels de rôles/statuts dupliqués | `ROLE_LABELS`/`STATUS_LABELS`/`STATUS_TONES` dans `AdminUsers`, `AdminUserDetail`, `SuperAdminAccounts` | Extraire dans `constants/` |
| D8 | Drawer mobile dupliqué | `AdminResultats`, `ModeTest` | Intégrer à `ApplicationLayout` |
| D9 | Modale CRUD inline | `SuperAdminRoles/Pages/Features/Accounts` | `CRUDModal` + `ConfirmModal` |
| D10 | Flash message inline | ~9 pages | `FlashMessage` |
| D11 | Avatars initiales inline | 5 pages | `Avatar` |
| D12 | Pages miroirs admin | `AdminUsers` ↔ `SuperAdminAccounts` (mêmes RPC/filtres/reset) | Fusion `AccountsPage`/`UsersPage` (à valider) |
| D13 | Login candidates côté stockage | `lib/storage.js` : comptes + imports + normalisation | Décomposer dans `services/` |
| D14 | Spinners « Chargement… » | toutes les pages de listing | `LoadingScreen` |

Code mort / obsolète : `printCandidateReport` (export.js), `findAccount` (storage.js), `assets/hero.png`, `react.svg`, `vite.svg`.
Bugs latents à corriger au passage : prop `action` de `PageTitle` ignorée, `currentUser` au lieu de `user` (4 pages), `NAVY` redéclaré.

## 5. Fichiers à renommer

| Actuel | Cible | Raison |
|--------|-------|--------|
| `pages/AdminResultats.jsx` | `pages/results/ResultsPage.jsx` | nom neutre (rôle hors URL) |
| `pages/AdminUsers.jsx` | `pages/administration/UsersPage.jsx` | idem |
| `pages/AdminUserDetail.jsx` | `components/.../UserDetail.jsx` (ou `pages/administration/UserDetail`) | composant partagé, nom neutre |
| `pages/ModeTest.jsx` | `pages/assessment/ModeTestPage.jsx` | idem |
| `pages/Profile.jsx` | `pages/account/AccountPage.jsx` | idem |
| `pages/TestApp.jsx` | `pages/assessment/TestPage.jsx` | idem |
| `pages/ResultsView.jsx` | `components/organisms/ResultsView.jsx` | c'est un composant, pas une page |
| `pages/UserLogin.jsx` | fusionné dans `pages/auth/AuthPage.jsx` | D6 |
| `pages/Login.jsx` | fusionné dans `pages/auth/AuthPage.jsx` | D6 |
| `pages/SuperAdminDashboard.jsx` | `pages/administration/DashboardPage.jsx` | nom neutre |
| `pages/SuperAdminAccounts.jsx` | fusion `pages/administration/AccountsPage.jsx` | D12 |
| `pages/SuperAdminRoles.jsx` | `pages/administration/RolesPage.jsx` | nom neutre |
| `pages/SuperAdminAccess.jsx` | `pages/administration/AccessControlPage.jsx` | nom neutre |
| `pages/SuperAdminPages.jsx` | `pages/administration/PagesPage.jsx` | nom neutre |
| `pages/SuperAdminFeatures.jsx` | `pages/administration/FeaturesPage.jsx` | nom neutre |

> Les noms ci-dessus sont des propositions à valider le moment venu.

## 6. Fichiers à déplacer

| Fichier | De | Vers | Remarque |
|---------|----|------|----------|
| `components/ui/*` (13) | `src/components/ui/` | `src/components/atoms/` + `molecules/` | répartis par nature |
| `components/layout/*` | `src/components/layout/` | `src/layouts/` (Sidebar, ApplicationLayout) ou `components/` (UserAvatar, SidebarFooter) | sauf widgets métier |
| `components/question/*` | `src/components/question/` | `src/components/question/` (inchangé) | + refactor `ResponsesReview` (D3) |
| `context/*` | `src/context/` | `src/contexts/` | doublons fusionnés (AuthContext unique) |
| `lib/storage.js` (comptes/imports/normalisation) | `src/lib/` | `src/services/accounts/`, `services/import/` | décomposé (D13) |
| `lib/scoring.js` | `src/lib/` | `src/utils/score/` | moteur pur, testable |
| `lib/candidates.js` | `src/lib/` | `src/services/` (candidates) | couche service |
| `lib/export.js` | `src/lib/` | `src/services/export/` | code mort supprimé (D4) |
| `lib/imported.js` | `src/lib/` | `src/services/import/` | avec normalisation |
| `reponses/*.json` | `src/reponses/` | conservé (données) | dépend de phase supabase |

## 7. Fichiers à fusionner

| Fusion | Résultat |
|--------|----------|
| `AppShell` + `SuperAdminLayout` | `layouts/ApplicationLayout` |
| `AuthShell` | `layouts/AuthLayout` (renommage simple) |
| `Sidebar` + `AdminSidebar` + `SuperAdminSidebar` | `layouts/Sidebar` + `SidebarNavigation*` + widgets `BatteryNav`/`CandidateList` |
| `Login` + `UserLogin` | `pages/auth/AuthPage` |
| `AdminUsers` + `SuperAdminAccounts` | `pages/administration/AccountsPage` (+ onglets si besoin) |
| `UserAuthContext` + `AdminAuthContext` | `contexts/AuthContext` |
| `ProtectedRoute` + `SuperAdminRoute` + `UserRoute` | `routes/RouteGuard` |
| `ResponsesReview` + batteries | batteries avec prop `readOnly` |
| `lib/export.js` + générateur PDF local `AdminResultats` | `services/export` (1 seule source) |

## 8. Nouveaux modules nécessaires

| Module | Type | Rôle |
|--------|------|------|
| `app/AppProviders.jsx` | app | assemblage providers |
| `routes/registry.js` | routes | décompose route_key/path/component/config (ADR-005) |
| `routes/RouteGuard.jsx` | routes | guard déclaratif (D5) |
| `constants/roles.js` | constants | `ROLE_LABELS`, slugs (extraits des pages, D7) |
| `constants/routes.js` | constants | route_keys techniques stables |
| `icons.js` ou map d'icônes | helper | mappage nom d'icône → lucide (pour `DEFAULT_PAGES`) |
| `utils/score/*` | utils | moteur de scoring pur (déplacé de `lib/scoring.js`) |
| `i18n/index.js` + `config.js` + locales | i18n | fr/en |
| `styles/` (tokens, globals, utilities, index) | styles | organisation styles globaux |
| `components/molecules/CRUDModal.jsx` | molecules | modale CRUD générique (D9) |
| `components/molecules/FlashMessage.jsx` | molecules | messages flash (D10) |
| `components/molecules/ConfirmModal.jsx` | molecules | confirmation destructive |
| `components/molecules/LoadingScreen.jsx` | molecules | écran de chargement (D14/D5) |
| `components/atoms/Avatar.jsx` + `AvatarSkeleton.jsx` + `index.js` | atoms | avatar initiales (D11) |
| `hooks/navigation/useActiveRoute.js` | hooks | route courante pour navigation |
| `hooks/data/*` | hooks | state server per-domaine |
| `services/auth/`, `services/users/`, `services/roles/`, `services/rbac/`, `services/results/` | services | couche d'accès |

## 9. Dépendances entre phases

```
Phase 0 (fondations ❗)  : config/, constants/, utils/score/, styles/, app/AppProviders, AlertProvider…   ← sans aucun import existant
        │
        └─▶ Phase 1 : contextes + services (AuthContext unique, services/auth|users|roles|rbac)   ← pré-requis de tout le reste
        │
        └─▶ Phase 2 : i18n (fr/en) — tôt pour éviter de re-traduire deux fois (peut démarrer en parallèle de la Phase 1)
        │
        └─▶ Phase 3 : layouts (ApplicationLayout + Sidebar dynamique) via navigation/registry   ← dépend de routes + i18n
        │
        └─▶ Phase 4 : registry routes + RouteGuard   ← dépend de Phases 1-3
        │
        └─▶ Phase 5 : composants transverses (PageTitle, CRUDModal, FlashMessage, LoadingScreen, Avatar, ConfirmModal)
        │
        └─▶ Phase 6 : pages par domaine + déduplication (AuthPage, fusions AdminUsers/SuperAdminAccounts, etc.)
        │
        └─▶ Phase 7 : nettoyage final
```

Règle : chaque phase **doit** produire un build vert (`pnpm run build`) et lint vert (`pnpm run lint`).

## 10. Ordre exact des phases (proposition)

| Phase | Intitulé | Contenu | Risque |
|-------|----------|---------|--------|
| **P0** | Fondations neutres | `config/`, `constants/`, `utils/score/` (moteur pur) , `styles/`, `app/AppProviders`, composants partagés sans impact | Faible |
| **P1** | Contextes + services | `AuthContext` unique (fusion), `services/auth|users|roles|rbac|results`, hooks `data/` | Élevé (auth) |
| **P2** | i18n fr/en | `i18n/index.js`, locales (début), `I18nContext`, externalisation page par page | Moyen |
| **P3** | Layouts | `ApplicationLayout`, `AuthLayout`, `Sidebar` dynamique + `BatteryNav`/`CandidateList` | Moyen |
| **P4** | Routing | `routes/registry.js`, `RouteGuard`, chemins cibles + redirections anciennes URLs | Élevé (URLs) |
| **P5** | Composants transverses | `PageTitle` (titleKey, fix prop `action`), `CRUDModal`, `FlashMessage`, `ConfirmModal`, `LoadingScreen`, `Avatar` ; purges D7/D10/D11/D14 | Faible |
| **P6** | Pages & déduplications | renommages §5, fusions §7 (AuthPage, AccountsPage, ResponsesReview readOnly, export unique), fix `currentUser`, suppression code mort | Moyen |
| **P7** | Nettoyage final | assets orphelins, `findAccount`, doc (`frontend.md` → aligné sur cible), validation complète | Faible |

> Deux chantiers pré-vus en parallèle (documentés, NON lancés sans validation) : migration des batteries vers Supabase, migration comptes/imports/résultats vers Supabase (feuille de route backend existante — voir `roadmap.md`).

## 11. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Casser l'authentification pendant la fusion des contextes | Moyenne | Critique | Phase dédiée (P1), test manuel complet des flux signup/login/logout/reset |
| Casser les anciens URLs/liens | Moyenne | Moyen | Redirections temporaires, garder un mapping ancien→nouveau le temps de la phase |
| Régressions UI (styles inline) | Moyenne | Moyen | `pnpm run build` + `pnpm run lint` après chaque phase |
| Perte d'information pendant les déplacements de docs | Faible | Moyen | Déplacements par `git mv` (fait pour les phases P1.3.4) , index mis à jour |
| Temps : refactor massif | Élevée | Moyen | Phases courtes, validations utilisateur entre chaque phase |

## 12. Périmètre NON couvert par cette refactorisation

- Batteries `data/battery*.js` → migrées plus tard vers Supabase (dette documentée, pas de modification maintenant).
- Comptes/imports/résultats localStorage → Supabase (phases P1.4/P1.5 de `roadmap.md`).
- Modèles de données backend, RPC, RLS (aucun changement).
- UI / design / thème (`theme.js` ne change pas).

---

*Dernière mise à jour : 2026-09-18*