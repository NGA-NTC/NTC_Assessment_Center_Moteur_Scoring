---
id: ARCH-ROUTING-TARGET-001
title: Architecture de routing — Cible
category: architecture
status: designed
version: 1.0.0
created_at: 2026-09-18
updated_at: 2026-09-18
source_of_truth: true
tags:
  - routing
  - routes
  - registry
  - architecture-cible
  - refactoring
---

# Architecture de routing — Cible

## 1. Problème actuel (inventaire)

`src/routes/index.jsx` déclare 18 routes en dur, avec :

- Des **chemins par rôle** dans l'URL : `/super-admin/*`, `/admin/*`.
- Des **guards copiés** (`ProtectedRoute`, `SuperAdminRoute`, `UserRoute`) — même squelette à 3 exemplaires.
- Des **composants nommés par rôle** (`SuperAdminDashboard`, `AdminResultats`, …).
- Les métadonnées de navigation mélangées à la déclaration (`SuperAdminSidebar` hardcode ses 7 items de nav).
- Les titres de pages hardcodés dans chaque page.

## 2. Principe : séparation des responsabilités d'une route

Une route est décomposée en **4 + 1** couches :

```
1. route_key (clé technique stable, non affichée)       →  e.g. "access-control"
2. path       (URL publique, sans rôle)                 →  "/acces"
3. composant React (frontend uniquement)                →  AccessControlPage
4. configuration / navigation (titleKey, section, order, show, …)
5. autorisation réelle (backend RBAC/RLS/RPC)           →  hors frontend
```

**Exemple cible (registry frontend) :**

```js
{
  key: "access-control",
  path: "/acces",
  component: AccessControlPage,
  titleKey: "pages.accessControl.title",
  navigation: {
    show: true,
    section: "administration",
    order: 30,
  },
  // audience / guards décrits en métadonnée, exécutés par un guard déclaratif
}
```

**Frontend** : `route_key + path + composant` (le code et le mapping restent dans le registry frontend).
**Supabase (ultérieurement)** : configuration dynamique `{ route_key, enabled, navigation_visible, section, order, parent, audience }`.
**RBAC/RLS/RPC** : autorisation réelle, le backend reste la **source de vérité**.

> Une route peut exister dans le code sans être affichée si elle n'est pas activée/configurée côté backend.
> ⚠️ Cache-soupape : masquer une route dans la navigation n'est **PAS** une sécurité.
> L'accès direct à l'URL reste protégé par le backend/RBAC quand nécessaire (ADR-001).

### Ce que Supabase ne stockera JAMAIS
- Code React, nom de fichier, import, composant ou logique frontend.

### Migration Supabase des routes
**Non implémentée maintenant.** Seule cette architecture cible est documentée (pas de table `pages`/`routes` supplémentaire à créer à ce stade).

## 3. URLs dynamiques et rôle

### Rôle absent de l'URL
Le rôle ne doit pas être inutilement présent dans l'URL.

| Avant (actuel) | Après (cible) |
|----------------|---------------|
| `/super-admin/acces` | `/acces` |
| `/super-admin/comptes` | `/comptes` |
| `/super-admin/roles` | `/roles` |
| `/admin` (résultats) | `/resultats` |
| `/super-admin/pages` | `/pages` |
| `/super-admin/fonctionnalites` | `/fonctionnalites` |
| `/test` | `/test` (inchangé) |
| `/compte` | `/compte` (inchangé) |

Le `route_key` reste **stable et technique** (ex. `access-control`). Le `path` est destiné à l'URL. Le composant React reste uniquement dans le frontend.

### `/compte` vs `/profil/:username`
Décision documentée (à ne PAS implémenter tant que le modèle de données n'existe pas) :

- `/compte` = gestion **personnelle** du compte connecté (cible = fusion de `Profile`).
- `/profil/:username` = futur profil **public ou consultable**.
- Ne pas utiliser un nom affiché comme identifiant d'URL : prévoir à terme un **username/slug unique et stable**.

## 4. Architecture cible des guards

Un **guard déclaratif unique** remplace les 3 guards copiés :

```js
// routes/guards.js
export function guardFor(route) {
  // route.meta.auth:    true | false
  // route.meta.permission: 'users.change_role'
  // route.meta.roles:   ['super_admin']  (présentation / UX uniquement)
  // → vérifie via AuthContext + services.rbac, redirige sinon
}
```

Cible : un seul composant `RouteGuard` (ou protection portée par `ApplicationLayout`), configuré par les métadonnées de route, vérification **backend** déléguée aux services/RPC. Les écrans « Chargement… » dupliqués deviennent un composant `LoadingScreen` partagé.

## 5. Registry cible (proposition à valider)

| route_key | path cible | Composant cible | Section nav | Ordre | Audience (métadonnée) |
|-----------|-----------|-----------------|-------------|-------|------------------------|
| `login` | `/connexion` | `AuthPage` (fusion `UserLogin`+`Login`) | – | – | public |
| `register` | `/inscription` | `RegisterPage` | – | – | public |
| `forgot-password` | `/mot-de-passe-oublie` | `ForgotPasswordPage` | – | – | public |
| `reset-password` | `/reinitialiser-mot-de-passe` | `ResetPasswordPage` | – | – | public |
| `home` | `/` | redirect → selon auth | – | – | – |
| `test` | `/test` | `TestPage` | — | – | authentifié |
| `change-password` | `/modifier-mot-de-passe` | `ChangePasswordPage` | « compte » | 20 | authentifié |
| `account` | `/compte` | `AccountPage` | « compte » | 10 | authentifié |
| `resultats` | `/resultats` | `ResultsPage` | « résultats » | 10 | admin / permission `results.read` |
| `utilisateurs` | `/utilisateurs` | `UsersPage` | « administration » | 20 | admin / permission `users.manage` |
| `mode-test` | `/mode-test/:id` | `ModeTestPage` | – | – | admin / permission `results.read` |
| `dashboard` | `/tableau-de-bord` | `DashboardPage` | « administration » | 10 | admin+ (*à valider*) |
| `comptes` | `/comptes` | `AccountsPage` (fusion `SuperAdminAccounts`+`AdminUsers`) | « administration » | 20 (fusion à valider) | admin+ / permission `accounts.manage` |
| `roles` | `/roles` | `RolesPage` | « administration » | 30 | permission `rbac.manage` |
| `access-control` | `/acces` | `AccessControlPage` (ex `SuperAdminAccess`) | « administration » | 30 | permission `rbac.manage` |
| `pages` | `/pages` | `PagesPage` | « administration » | 40 | permission `config.pages` |
| `fonctionnalites` | `/fonctionnalites` | `FeaturesPage` | « administration » | 50 | permission `config.features` |

> ⚠️ Ce tableau est une **proposition à valider** (notamment les fusions `comptes`/`utilisateurs` et la route `dashboard`). Aucune modification n'a été faite.

## 6. Navigation dynamique (Sidebar)

Le contenu du sidebar dépend **uniquement** :
- de l'utilisateur / de l'authentification,
- des rôles / permissions / capabilities (fournies par le backend),
- de la route/page courante,
- de la configuration des pages/routes (section, ordre, visibilité).

**Interdits** : `SuperAdminSidebar`, `AdminSidebar`, `CandidateSidebar`, `SuperAdminLayout`, `AdminLayout`, `CandidateLayout`.
Aucun code du type `if (role === "super_admin") { afficher… }` pour simuler des autorisations.
Le backend reste la source de vérité.

Architecture cible : voir [`component-architecture.md`](./component-architecture.md) (module `Sidebar`).

## 7. Interactions routes ↔ PageTitle ↔ i18n

Chaîne cible :

```
route (titleKey)
  → i18n (namespace pages.*)
  → PageTitle (composant unique)
  → document.title  ("Titre de la page | NTC Assessment Center")
```

- Les titres ne sont jamais hardcodés dans les pages.
- La route fournit `titleKey` ou une métadonnée équivalente.
- Le système est déclaratif et multilingue (fr/en). Détails : [`i18n-architecture.md`](./i18n-architecture.md).

## 8. Liens avec la sécurité

- La visibilité de navigation ≠ autorisation.
- L'autorisation effective est décidée côté Supabase (RLS/RPC). Les métadonnées de route (`audience`, `permission`) servent l'UX et le guard d'application, pas la sécurité réelle.
- ADR de référence : [`ADR-001-frontend-untrusted`](../decisions/ADR-001-frontend-untrusted.md), [`ADR-dynamic-routing`](../decisions/ADR-dynamic-routing.md).

---

*Dernière mise à jour : 2026-09-18*