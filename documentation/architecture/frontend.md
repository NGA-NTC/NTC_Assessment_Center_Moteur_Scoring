---
id: ARCH-FRONTEND-001
title: Architecture Frontend
category: architecture
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - frontend
  - react
  - vite
  - routing
  - contexts
---

# Architecture Frontend

## Stack

| Technologie | Version | Rôle |
|-------------|---------|------|
| React | 19.2.8 | Bibliothèque UI |
| Vite | 8.2.2 | Build tool + Dev server |
| React Router | 7.18.3 | Routing + Guards |
| ESLint | 10.9.0 | Linting |

## Structure des dossiers `src/`

```
src/
├── main.jsx                 # Point d'entrée
├── index.css                # Styles globaux + Google Fonts
├── routes/
│   ├── index.jsx            # Déclaration routes + guards
│   ├── ProtectedRoute.jsx   # Guard admin (AdminAuthContext)
│   ├── SuperAdminRoute.jsx  # Guard super_admin (UserAuthContext)
│   └── UserRoute.jsx        # Guard candidat connecté (UserAuthContext)
├── context/
│   ├── UserAuthContext.jsx  # Auth candidat + roles/permissions
│   └── AdminAuthContext.jsx # Auth admin (admin/super_admin)
├── pages/                   # Pages de l'application
├── components/
│   ├── layout/              # Shells + Sidebars
│   ├── ui/                  # Composants UI réutilisables
│   └── question/            # Composants batteries de test
├── data/                    # Données statiques (batteries, dimensions, axes, métiers)
├── lib/                     # Utilitaires (storage, scoring, theme, supabaseClient)
└── reponses/                # Exemples JSON importables
```

## Routing & Guards

### Déclaration des routes (`src/routes/index.jsx`)

```jsx
<UserAuthProvider>
  <AdminAuthProvider>
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/connexion" replace />} />
        <Route path="/connexion" element={<UserLogin />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route path="/login" element={<Login />} />

        {/* Candidat connecté */}
        <Route path="/test" element={<UserRoute><TestApp /></UserRoute>} />
        <Route path="/modifier-mot-de-passe" element={<UserRoute><ChangePassword /></UserRoute>} />
        <Route path="/compte" element={<UserRoute><Profile /></UserRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute><AdminResultats /></ProtectedRoute>} />
        <Route path="/admin/utilisateurs" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/mode-test/:id" element={<ProtectedRoute><ModeTest /></ProtectedRoute>} />

        {/* Super Admin */}
        <Route element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/comptes" element={<SuperAdminAccounts />} />
          <Route path="/super-admin/roles" element={<SuperAdminRoles />} />
          <Route path="/super-admin/acces" element={<SuperAdminAccess />} />
          <Route path="/super-admin/pages" element={<SuperAdminPages />} />
          <Route path="/super-admin/fonctionnalites" element={<SuperAdminFeatures />} />
        </Route>

        <Route path="*" element={<Navigate to="/connexion" replace />} />
      </Routes>
    </BrowserRouter>
  </AdminAuthProvider>
</UserAuthProvider>
```

### Guards

| Guard | Fichier | Contexte | Vérification | Redirection |
|-------|---------|----------|--------------|-------------|
| `UserRoute` | `UserRoute.jsx` | UserAuthContext | `user` existe | `/connexion` |
| `ProtectedRoute` | `ProtectedRoute.jsx` | AdminAuthContext | `isAuthenticated` (admin/super_admin) | `/login` |
| `SuperAdminRoute` | `SuperAdminRoute.jsx` | UserAuthContext | `hasRole('super_admin')` | `/login` |

## Contextes d'authentification

### UserAuthContext (`src/context/UserAuthContext.jsx`)

**État exposé :**
- `user` : `auth.User` | null
- `session` : `auth.Session` | null
- `profile` : `Profile` | null (table `profiles`)
- `roles` : `Role[]` (avec `id`, `name`, `description`)
- `permissions` : `Permission[]` (avec `id`, `name`, `description`, `category`)
- `loading` : boolean
- `isAdmin` : boolean (admin ou super_admin)
- `hasRole(roleId)` : boolean
- `hasPermission(permId)` : boolean

**Méthodes :**
- `register(email, password)`
- `login(email, password)`
- `logout()`
- `resetPassword(email)`
- `updatePassword(newPassword)`
- `updateProfile(updates)`
- `refreshUserData()`

**Initialisation :**
1. `supabase.auth.getSession()` → session/utilisateur
2. Si user : `fetchProfile()` + `fetchRoles()` (joint `user_roles` + `roles` + `role_permissions` + `permissions`)
3. `onAuthStateChange` → met à jour tout changement

### AdminAuthContext (`src/context/AdminAuthContext.jsx`)

**État exposé :**
- `isAuthenticated` : boolean
- `adminUser` : `auth.User` | null
- `loading` : boolean
- `login(email, password)`
- `logout()`

**Vérification admin :**
```js
checkAdmin(session) = 
  supabase.from('user_roles')
    .select('role_id')
    .eq('user_id', session.user.id)
    .in('role_id', ['admin', 'super_admin'])
    .single()
```

## Pages principales

| Page | Fichier | Accès | Description |
|------|---------|-------|-------------|
| `UserLogin` | `UserLogin.jsx` | Public | Connexion candidat |
| `Register` | `Register.jsx` | Public | Inscription candidat |
| `Login` | `Login.jsx` | Public | Connexion admin |
| `ForgotPassword` | `ForgotPassword.jsx` | Public | Mot de passe oublié |
| `ResetPassword` | `ResetPassword.jsx` | Public | Réinitialisation MDP |
| `TestApp` | `TestApp.jsx` | Candidat | Passage batteries (8) |
| `ChangePassword` | `ChangePassword.jsx` | Candidat | Modification MDP |
| `Profile` | `Profile.jsx` | Candidat | Mon compte |
| `AdminResultats` | `AdminResultats.jsx` | Admin | Liste/détail candidats + export |
| `AdminUsers` | `AdminUsers.jsx` | Admin | Gestion utilisateurs admin |
| `ModeTest` | `ModeTest.jsx` | Admin | Relecture réponses candidat |
| `SuperAdminDashboard` | `SuperAdminDashboard.jsx` | Super Admin | Dashboard + stats |
| `SuperAdminAccounts` | `SuperAdminAccounts.jsx` | Super Admin | CRUD utilisateurs |
| `SuperAdminRoles` | `SuperAdminRoles.jsx` | Super Admin | CRUD rôles + permissions |
| `SuperAdminAccess` | `SuperAdminAccess.jsx` | Super Admin | Délégations + permissions |
| `SuperAdminPages` | `SuperAdminPages.jsx` | Super Admin | CRUD pages |
| `SuperAdminFeatures` | `SuperAdminFeatures.jsx` | Super Admin | CRUD fonctionnalités |
| `Profile` | `Profile.jsx` | Connecté | Mon compte (candidat/admin/super_admin) |
| `ChangePassword` | `ChangePassword.jsx` | Connecté | Modifier MDP |

## Composants de layout

### AppShell (`src/components/layout/AppShell.jsx`)
Shell générique : sidebar + main content (max-width configurable).

### SuperAdminLayout (`src/components/layout/SuperAdminLayout.jsx`)
Shell Super Admin : sidebar SuperAdminSidebar + header "Super Admin" + zone de contenu.

### Sidebars

| Sidebar | Fichier | Usage | Navigation |
|---------|---------|-------|------------|
| `Sidebar` | `Sidebar.jsx` | Candidat | Batteries B1-B8 + progression + déconnexion |
| `AdminSidebar` | `AdminSidebar.jsx` | Admin | Recherche + filtres + liste candidats + déconnexion |
| `SuperAdminSidebar` | `SuperAdminSidebar.jsx` | Super Admin | Navigation complète (Vue d'ensemble, Comptes, Rôles, Accès, Pages, Fonctionnalités, Résultats, Test, Mon compte, MDP, Déconnexion) |

### UserAvatar (`src/components/layout/UserAvatar.jsx`)
Avatar + dropdown dynamique selon rôle :
- `super_admin` → "Espace Super Admin" → `/super-admin`
- `admin` → "Espace administrateur" → `/admin`
- `candidate` → "Mon espace candidat" → `/test`
- Toujours : "Mon compte", "Modifier le mot de passe", "Passer le test", "Déconnexion"

## Composants UI réutilisables (`src/components/ui/`)

| Composant | Description |
|-----------|-------------|
| `Button` | Bouton (variants: primary, outline, ghost, danger; sizes: sm, md, lg) |
| `Field` | Champ input/select/textarea avec label + icône optionnelle |
| `PasswordField` | Champ password avec toggle visibilité |
| `SearchField` | Champ recherche avec icône loupe |
| `FilterDropdown` | Dropdown multi-filtres (métiers, axes, progression, type) |
| `PageTitle` | Titre de page + sous-titre + action optionnelle |
| `Card` | Carte cliquable ou conteneur |
| `Badge` | Badge coloré (tones: success, warning, muted, import) |
| `ProgressCircle` | Cercle de progression (pourcentage) |
| `RowMenu` | Menu contextuel (⋯) avec items + danger |
| `BrandHeader` | Header marque (page auth) |
| `FormCard` | Carte formulaire avec onSubmit |
| `ImportJsonButton` | Bouton import JSON (file input caché) |
| `PasswordField` | Champ password avec toggle |
| `PageTitle` | Titre + sous-titre + action droite |
| `BrandHeader` | Header authentification |

## Gestion d'état

### localStorage (via `src/lib/storage.js`)

| Clé | Contenu |
|-----|---------|
| `ntc_users` | `{ email, password, createdAt, updatedAt, responses: {mcq, b7, b8} }[]` |
| `ntc_imported` | `{ id, label, email?, responses, createdAt, kind, file?, accountEmail?, hidden? }[]` |
| `ntc_auth` | Session admin (token) |
| `ntc_user_session` | Session candidat |

### État React (contextes)

- `UserAuthContext` : user, session, profile, roles, permissions, loading
- `AdminAuthContext` : isAuthenticated, adminUser, loading
- `TestApp` : active (batterie), responses, hydrated, mobileSidebarOpen
- `AdminResultats` : accounts, imports, selection, filters, viewMode, modals
- `SuperAdminPages/Features/Accounts/Roles/Access` : loading, data, modals, messages

## Composants de question (`src/components/question/`)

| Composant | Type de batterie | Description |
|-----------|----------------|-------------|
| `McqBattery` | `correct` / `weighted` | QCM (batteries 1-6) |
| `RubricBattery` | `rubric` | Cas (B7) - grille d'évaluation 5 dimensions |
| `CoherenceBattery` | `coherence` | Simulations B8 - intensité (léger/modéré/fort) |
| `QuestionCard` | Commun | Affichage question + progression |
| `OptionButton` | QCM | Bouton réponse |
| `IntensityToggle` | B8 | Sélecteur intensité (léger/modéré/fort/non observé) |
| `ResponsesReview` | Relecture | Affichage réponses (mode test admin) |
| `RubricScorer` | B7 | Grille d'évaluation |
| `InfoCallout` | Info | Encart informationnel |

## Responsive

| Breakpoint | Largeur | Comportement |
|------------|---------|--------------|
| Tablette | `max-width: 1024px` | Sidebar réduite, grilles adaptées |
| Mobile | `max-width: 768px` | Sidebar drawer, grilles `auto-fit`, composants empilés |

### Composants adaptatifs
- `AppShell` : colonne sur mobile, sidebar pleine largeur
- `Sidebar` / `AdminSidebar` / `SuperAdminSidebar` : drawer mobile
- `ResultsView` : grilles `auto-fit` (`minmax(280px, 1fr)`)
- `IntensityToggle` / B8 : pile (libellé + options)
- `FilterDropdown` / `SearchField` : fluides (`minWidth: 0`)

## Gestion des sessions

### Candidat (`UserAuthContext`)
- `supabase.auth.getSession()` + `onAuthStateChange`
- `loadAccountResponses(email)` → localStorage `ntc_users`
- Sauvegarde auto `saveAccountResponses(email, responses)` (debounce 400ms)

### Admin (`AdminAuthContext`)
- `checkAdmin(session)` → `user_roles` (admin/super_admin)
- Session admin stockée dans `ntc_auth` (localStorage)

### Super Admin
- `SuperAdminRoute` → `hasRole('super_admin')` via `UserAuthContext`

## Navigation entre espaces

| Depuis | Vers | Mécanisme |
|--------|------|-----------|
| Super Admin Dashboard | Admin Résultats | Bouton "Accéder aux résultats" → `/admin` |
| Admin Résultats | Super Admin | Bouton "Retour à l'espace Super Admin" (visible si `isSuperAdmin`) |
| Test App | Super Admin / Admin | Bouton "Retour à l'espace X" (selon `isSuperAdmin` / `isAdmin`) |
| Dropdown UserAvatar | Selon rôle | `spaceInfo.path` dynamique |

## Tests

- Pas de tests automatisés configurés actuellement
- Vérification manuelle via `pnpm run dev` / `pnpm run build`
- Lint : `pnpm run lint` (ESLint + eslint-plugin-react-hooks + react-refresh)

---

*Dernière mise à jour : 2026-09-15*