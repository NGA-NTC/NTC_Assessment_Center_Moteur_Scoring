---
id: REF-ROUTES-001
title: Référence des routes
category: reference
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - routes
  - routing
  - guards
---

# Référence des routes

## Tableau complet

| URL | Composant | Guard | Accès | Description |
|-----|-----------|-------|-------|-------------|
| `/` | `Navigate` | — | Public | Redirige vers `/connexion` |
| `/connexion` | `UserLogin` | — | Public | Connexion candidat |
| `/inscription` | `Register` | — | Public | Création compte candidat |
| `/mot-de-passe-oublie` | `ForgotPassword` | — | Public | Demande reset MDP |
| `/reinitialiser-mot-de-passe` | `ResetPassword` | — | Public | Formulaire reset MDP (token URL) |
| `/login` | `Login` | — | Public | Connexion administrateur |
| `/test` | `TestApp` | `UserRoute` | Candidat connecté | Passage 8 batteries |
| `/modifier-mot-de-passe` | `ChangePassword` | `UserRoute` | Connecté | Modification MDP |
| `/compte` | `Profile` | `UserRoute` | Connecté | Mon compte |
| `/admin` | `AdminResultats` | `ProtectedRoute` | Admin connecté | Résultats + gestion |
| `/admin/utilisateurs` | `AdminUsers` | `ProtectedRoute` | Admin connecté | Gestion utilisateurs admin |
| `/admin/mode-test/:id` | `ModeTest` | `ProtectedRoute` | Admin connecté | Relecture réponses candidat |
| `/super-admin` | `SuperAdminDashboard` | `SuperAdminRoute` | Super Admin | Dashboard Super Admin |
| `/super-admin/comptes` | `SuperAdminAccounts` | `SuperAdminRoute` | Super Admin | CRUD utilisateurs |
| `/super-admin/roles` | `SuperAdminRoles` | `SuperAdminRoute` | Super Admin | CRUD rôles + permissions |
| `/super-admin/acces` | `SuperAdminAccess` | `SuperAdminRoute` | Super Admin | Délégations + permissions |
| `/super-admin/pages` | `SuperAdminPages` | `SuperAdminRoute` | Super Admin | CRUD pages |
| `/super-admin/fonctionnalites` | `SuperAdminFeatures` | `SuperAdminRoute` | Super Admin | CRUD fonctionnalités |
| `*` | `Navigate` | — | — | Redirige vers `/connexion` |

---

## Guards

| Guard | Fichier | Contexte | Vérification | Redirection |
|-------|---------|----------|--------------|-------------|
| `UserRoute` | `src/routes/UserRoute.jsx` | `UserAuthContext` | `user` existe | `/connexion` |
| `ProtectedRoute` | `src/routes/ProtectedRoute.jsx` | `AdminAuthContext` | `isAuthenticated` (admin/super_admin) | `/login` |
| `SuperAdminRoute` | `src/routes/SuperAdminRoute.jsx` | `UserAuthContext` | `hasRole('super_admin')` | `/login` |

### Implémentation `UserRoute`

```jsx
const { user, loading } = useUserAuth();
if (loading) return <Loading />;
if (!user) return <Navigate to="/connexion" replace />;
return children;
```

### Implémentation `ProtectedRoute`

```jsx
const { isAuthenticated, loading } = useAdminAuth();
if (loading) return <Loading />;
if (!isAuthenticated) return <Navigate to="/login" replace />;
return children;
```

### Implémentation `SuperAdminRoute`

```jsx
const { hasRole, loading } = useUserAuth();
if (loading) return <Loading />;
if (!hasRole('super_admin')) return <Navigate to="/login" replace />;
return children;
```

---

## Hiérarchie des layouts

```
AppRoutes
├── UserAuthProvider
│   └── AdminAuthProvider
│       └── BrowserRouter
│           ├── Routes publiques (/, /connexion, /inscription, /login, ...)
│           ├── UserRoute
│           │   └── TestApp, ChangePassword, Profile
│           ├── ProtectedRoute
│           │   └── AdminResultats, AdminUsers, ModeTest
│           └── SuperAdminRoute
│               └── SuperAdminLayout
│                   └── SuperAdminDashboard, SuperAdminAccounts, ...
```

---

## Navigation entre espaces

| Depuis | Vers | Mécanisme |
|--------|------|-----------|
| Super Admin Dashboard | `/admin` | Bouton "Accéder aux résultats" |
| Admin Résultats | `/super-admin` | Bouton "Retour à l'espace Super Admin" (si `isSuperAdmin`) |
| Test App | `/super-admin` ou `/admin` | Bouton "Retour à l'espace X" |
| Dropdown UserAvatar | Selon rôle | `spaceInfo.path` dynamique |

---

## Paramètres de route

| Route | Paramètres | Description |
|-------|------------|-------------|
| `/admin/mode-test/:id` | `id` (string) | ID candidat pour relecture mode test |

---

## Redirections

| Condition | Redirection |
|-----------|-------------|
| `/` | `/connexion` |
| Non authentifié sur route protégée | `/connexion` (candidat) ou `/login` (admin) |
| Non admin sur `/admin` | `/login` |
| Non super_admin sur `/super-admin/*` | `/login` |
| Route inconnue (`*`) | `/connexion` |

---

## Navigation programmatiques

### Dans composants

```jsx
import { useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext.jsx";

const navigate = useNavigate();
const { hasRole } = useUserAuth();

const goToAdmin = () => navigate("/admin");
const goToSuperAdmin = () => navigate("/super-admin");
const goBack = () => navigate(-1);
```

### Dans UserAvatar (dropdown)

```jsx
const goSpace = () => {
  navigate(spaceInfo.path); // spaceInfo.path = '/super-admin' | '/admin' | '/test'
};
```

---

*Dernière mise à jour : 2026-09-15*