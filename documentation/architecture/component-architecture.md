---
id: ARCH-COMPONENT-TARGET-001
title: Architecture des composants — Cible
category: architecture
status: designed
version: 1.0.0
created_at: 2026-09-18
updated_at: 2026-09-18
source_of_truth: true
tags:
  - components
  - react
  - architecture-cible
  - refactoring
---

# Architecture des composants — Cible

## 1. Organisation générale

```
src/components/
├── atoms/            # Boutons, champs, badges, icônes (composants UI génériques)
├── molecules/        # Association d'atomes (SearchField + résultat, FormCard, …)
├── organisms/        # Blocs composites réutilisables (AdminResultsTable, CRUDModal, …)
└── <domaine>/        # Composants métier complexes avec leur propre dossier
```

- **Atomic Design est facultatif** ; ne pas l'appliquer mécaniquement.
- Un **composant métier complexe** peut avoir son propre dossier.
- `components/` est **indépendant du rôle** : un composant ne connaît pas `super_admin`/`admin`/`candidate` sauf si son comportement est intrinsèquement lié à un rôle (interdiction du `if (role === …)` pour les autorisations).

### Exemple de structure par composant (seulement quand utile)

```
components/ResultsTable/
├── ResultsTable.jsx
├── ResultsTableSkeleton.jsx
├── ResultsTableEmpty.jsx
├── ResultsTableError.jsx
└── index.js
```

> Ne pas créer de fichiers inutiles (Skeleton/Empty/Error) uniquement pour suivre une règle. Créer ces variantes quand l'état existe réellement.

## 2. Layouts et Sidebar dynamique (cible)

Site d'accueil : `src/layouts/`.

```
src/layouts/
├── ApplicationLayout/     # shell unique : sidebar + header + contenu (remplace AppShell + SuperAdminLayout)
├── AuthLayout/            # shell authentification (remplace AuthShell)
└── Sidebar/
    ├── Sidebar.jsx
    ├── SidebarLogo.jsx
    ├── SidebarNavigation.jsx
    ├── SidebarSection.jsx
    ├── SidebarNavigationItem.jsx
    ├── SidebarFooter.jsx
    └── SidebarUser.jsx
```

- `Sidebar` est **un seul composant** paramétré par la configuration de navigation (voir `routing-architecture.md`) : sections, ordre, visibilité.
- Le contenu dépend dynamiquement de l'utilisateur, de l'authentification, des **permissions/capabilities (backend)**, de la route courante et de la configuration des pages/routes.
- **Interdit** : `if (role === "super_admin") { … }` pour simuler des autorisations.
- Interdits : `SuperAdminSidebar`, `AdminSidebar`, `CandidateSidebar`, `SuperAdminLayout`, `AdminLayout`, `CandidateLayout`.

> Les barres latérales métier actuelles (`AdminSidebar` = recherche/filtres/candidats, `Sidebar` = batteries) ne sont **pas** des « sidebars de navigation » : ce sont des composants métier de liste (p.ex. `CandidateList`, `BatteryNav`) qui seront logés dans `components/` selon leur responsabilité.

## 3. Composants UI cibles (inventaire → cible)

Les composants `ui/` actuels sont **conservés** et réorganisés dans `atoms/`/`molecules/` :

| Actuel (`components/ui`) | Cible | Notes |
|--------------------------|-------|-------|
| `Button` | `atoms/Button` | inchangé |
| `Field` | `atoms/Field` | inchangé |
| `PasswordField` | `molecules/PasswordField` | wrapper de Field |
| `SearchField` | `molecules/SearchField` | |
| `Badge` | `atoms/Badge` | |
| `ProgressCircle` | `atoms/ProgressCircle` | |
| `Card` | `atoms/Card` | |
| `BrandHeader` | `molecules/BrandHeader` | |
| `FormCard` | `molecules/FormCard` | |
| `PageTitle` | `molecules/PageTitle` | voir §4 — prop `right`, plus d'`action` fantôme |
| `FilterDropdown` | `molecules/FilterDropdown` | |
| `ImportJsonButton` | `molecules/ImportJsonButton` | |
| `RowMenu` | `molecules/RowMenu` | |

## 4. Système PageTitle (titre de page)

Chaîne cible : `route.titleKey → i18n → PageTitle → document.title`.

- `PageTitle` accepte `titleKey` (résolue via i18n) OU un titre traduit, + `subtitleKey`, `actions`.
- Supprime la prop fantôme `action` (actuellement ignorée dans 5 pages Super Admin → boutons « Sauvegarder », « Nouvelle page »… non rendus).
- `document.title` = `"{title} | NTC Assessment Center"` (suffixe global, configurable).
- Les pages ne hardcodent plus leurs titres.

## 5. Nouveaux composants transverses (gap identifié)

| Composant | Rôle | Remplace |
|-----------|------|----------|
| `LoadingScreen` | Écran « Chargement… » unique | les 3 copies des gardes + spinners des pages Super Admin |
| `FlashMessage` | Message succès/erreur `{type, text}` | les ~9 patterns `#E3F0E4`/`#FAE8E6` dupliqués |
| `CRUDModal` | Modale CRUD générique (overlay, carte, header ×, footer Annuler/Créer) | les 4 modales copiées (`SuperAdminRoles/Pages/Features/Accounts`) |
| `ConfirmModal` | Confirmation de suppression | les `window.confirm(...)` et variantes inline |
| `Avatar` (`AvatarSkeleton` + `index.js`) | Avatar initiales | les ~5 implémentations inline de pastilles initiales |
| `Sidebar.*` | voir §2 | les 3 sidebars dupliquées |
| `ResponsesReview` unifié | Relecture readonly unifiée | `ResponsesReview` actuel qui duplique `McqBattery`+`RubricBattery`+`CoherenceBattery` |

## 6. Composants à NE PAS créer

- Un `CRUDModal` par domaine.
- Des variantes `*Skeleton`/`*Empty`/`*Error` quand l'état n'existe pas.
- Un fichier par petite fonction (principe KISS / pas de fragmentation artificielle).

## 7. Doublons à traiter (inventaire complet)

| # | Doublon | Élément concernés | Action cible |
|---|---------|-------------------|--------------|
| 1 | **3 sidebars** structurellement identiques | `Sidebar`, `AdminSidebar`, `SuperAdminSidebar` | Fusionner en `Sidebar` paramétrable + composants métier (`BatteryNav`, `CandidateList`) |
| 2 | **Layouts jumeaux** | `AppShell` ≈ `SuperAdminLayout` | Fusionner dans `ApplicationLayout` + `AuthLayout` |
| 3 | **Relecture dupliquée** | `ResponsesReview` (≥ `McqBattery`+`RubricBattery`+`CoherenceBattery` + const `B7_DIMS`/`B8_OPTS`/`ReadonlyOption`) | Réutiliser les batteries avec prop `readOnly`, constantes partagées |
| 4 | **Générateur PDF dupliqué** | `lib/export.js` (`printCandidateReport`, code mort) vs copie locale dans `AdminResultats` | Conserver UNE seule source (dans `services`/`utils`), supprimer le code mort |
| 5 | **3 guards identiques** | `ProtectedRoute`, `SuperAdminRoute`, `UserRoute` | Un `RouteGuard` déclaratif + `LoadingScreen` |
| 6 | **2 pages de login miroirs** | `Login` (admin) vs `UserLogin` (candidat) | Fusionner dans `AuthPage` (redirection par rôle après connexion) |
| 7 | **Label/rôles dupliqués** | `ROLE_LABELS`, `STATUS_LABELS`, `STATUS_TONES` dans `AdminUsers`, `AdminUserDetail`, `SuperAdminAccounts` | Extraire dans `constants/` |
| 8 | **Drawer mobile dupliqué** | `AdminResultats`, `ModeTest` (backdrop + aside + Escape) | Intégrer à `ApplicationLayout` |
| 9 | **Modales CRUD / FlashMessage** | 4 pages Super Admin | `CRUDModal` + `FlashMessage` |
| 10 | **Avatars initiales inline** | 5 pages | `Avatar` |
| 11 | **Spinners « Chargement… »** | toutes pages de listing | `LoadingScreen` |
| 12 | **PDF/template HTML** | `export.js` vs `AdminResultats` | dédupliquer (voir #4) |

### Composants inutilisés / obsolètes
- `lib/export.js` → `printCandidateReport` (jamais importé).
- `assets/hero.png`, `react.svg`, `vite.svg` (non référencés).
- `storage.js` → `findAccount` (fonction orpheline, aucune importation).
- Pages : pas de page orpheline ; toutes sont routées.

## 8. Bugs latents identifiés (signalés, non corrigés)
- Prop `action` de `PageTitle` ignorée (5 pages) → boutons non rendus.
- `currentUser` au lieu de `user` dans 4 pages (`ForgotPassword`, `ResetPassword`, `Register`, `ChangePassword`) → redirections inopérantes.
- `NAVY = "#1B2A4A"` redéclaré localement dans `AdminResultats` et `ResultsView`.

---

*Dernière mise à jour : 2026-09-18*