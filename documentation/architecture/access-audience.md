---
id: ARCH-ACCESS-AUDIENCE-001
title: Distinction ROLE / AUTH STATE / ACCESS AUDIENCE / PERMISSION
category: architecture
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - access-audience
  - authorization
  - roles
---

# Distinction ROLE / AUTH STATE / ACCESS AUDIENCE / PERMISSION

## Pourquoi cette distinction ?

NTC sépare **4 concepts orthogonaux** souvent confondus. Cette séparation est la clé d'un système d'autorisation flexible et sécurisé.

---

## Les 4 concepts

| Concept | Question | Domaine | Exemples | Stockage |
|---------|----------|---------|----------|----------|
| **ROLE** | "Qu'est-ce que l'utilisateur EST ?" | Métier / Organisation | `super_admin`, `admin`, `encadreur`, `recruteur`, `candidat` | `roles` + `user_roles` |
| **AUTHENTICATION STATE** | "Comment l'utilisateur SE CONNECTE ?" | Technique / Session | `anonymous`, `authenticated` | `auth.users` (session) |
| **ACCESS AUDIENCE** | "QUI peut accéder à cette RESSOURCE ?" | Politique déclarative sur la ressource | `public`, `authenticated`, `role_based` | `pages.access_audience`, `features.access_audience` |
| **PERMISSION / CAPABILITY** | "QUELLE action est autorisée ?" | Granulaire, dynamique | `USE`, `MANAGE`, `GRANT`, `DELEGATE` | `role_permissions.can_*` + délégations |

---

## 1. ROLE — Identité organisationnelle

| Aspect | Détail |
|--------|--------|
| **Définition** | Ce que l'utilisateur EST dans l'organisation |
| **Exemples** | `super_admin`, `admin`, `encadreur`, `recruteur`, `candidat` |
| **Stockage** | `roles` (définition) + `user_roles` (attribution) |
| **Dynamique** | Peut changer (promotion, révocation) |
| **Hiérarchie** | Structurelle (`parent_id`, `hierarchy_level`) — **info only** |

> **Règle** : Un rôle ne donne **pas** de permission par son nom. Les permissions viennent de `role_permissions` + délégations.

---

## 2. AUTHENTICATION STATE — État de session

| Valeur | Signification |
|--------|---------------|
| `anonymous` | Pas de session Supabase (pas de JWT valide) |
| `authenticated` | Session Supabase valide (JWT + user_id) |

| Aspect | Détail |
|--------|--------|
| **Origine** | `supabase.auth.getSession()` / `onAuthStateChange` |
| **Portée** | Technique uniquement (session JWT) |
| **Ne dépend PAS** | Des rôles, permissions, audiences |
| **Géré par** | Supabase Auth (JWT + refresh token) |

> **Règle** : `anonymous` / `authenticated` = état technique de la session. Ne confère **aucune** permission.

---

## 3. ACCESS AUDIENCE — Politique d'accès à la ressource

Déclarée **sur la ressource** (page ou feature), pas sur l'utilisateur.

| Valeur | Signification | Vérification requise |
|--------|---------------|---------------------|
| `public` | Accessible sans authentification | **Aucune** (même `anonymous`) |
| `authenticated` | Session authentifiée obligatoire | `auth.uid() IS NOT NULL` |
| `role_based` | Session + permission/capacité requise | `has_effective_permission()` + scope |

### Déclaration sur les ressources

#### Pages (`pages` table)

| Colonne | Type | Défaut | Valeurs |
|---------|------|--------|---------|
| `access_audience` | text | `'authenticated'` | `public`, `authenticated`, `role_based` |
| `access_permission` | text FK → `permissions(id)` | NULL | Permission requise si `role_based` |

### Features (`features` table)

| Colonne | Type | Défaut | Valeurs |
|---------|------|--------|---------|
| `access_audience` | text | `'role_based'` | `public`, `authenticated`, `role_based` |
| `access_permission` | text FK → `permissions(id)` | NULL | Permission si `role_based` |
| `access_scope_type` | text CHECK | NULL | `global`, `role`, `user`, `self` |
| `access_scope_value` | text | NULL | Ex: `role:encadreur` |

---

## Règle de résolution d'accès

### Pour une PAGE

```
SI page.access_audience = 'public'        → ACCÈS (même anonymous)
SINON SI page.access_audience = 'authenticated' → SI authenticated → ACCÈS
SINON SI page.access_audience = 'role_based'  → SI has_effective_permission(user, page.access_permission, scope) → ACCÈS
```

### Pour une FEATURE

```
SI feature.access_audience = 'public'        → ACCÈS
SINON SI feature.access_audience = 'authenticated' → SI authenticated → ACCÈS
SINON SI feature.access_audience = 'role_based'  → SI has_effective_permission(user, feature.access_permission, feature.access_scope_type, feature.access_scope_value) → ACCÈS
```

### Indépendance Page / Feature

> **Règle** : Une feature protégée ne rend **pas** sa page inaccessible.

```
PAGE (access_audience = 'public')
  ├─ FEATURE A (access_audience = 'public')       → Tout le monde
  ├─ FEATURE B (access_audience = 'authenticated') → Connectés seulement
  └─ FEATURE C (access_audience = 'role_based')    → Permission + scope requis
```

> La page reste accessible publiquement. Les features protégées sont masquées/désactivées dans l'UI.

---

## 4. PERMISSION / CAPABILITY — Actions autorisées

### 4 niveaux distincts (orthogonaux)

| Code | Nom | Description |
|------|-----|-------------|
| `USE` | Utiliser | Lire, exécuter, consulter |
| `MANAGE` | Gérer | CRUD complet sur la ressource |
| `GRANT` | Accorder | Attribuer cette permission à d'autres |
| `DELEGATE` | Déléguer | Permettre à un autre rôle de GRANT cette permission |

> **Règle stricte** : Aucune inclusion automatique. `MANAGE` ⇏ `GRANT` ⇏ `DELEGATE`. Chaque drapeau géré explicitement.

### Stockage : `role_permissions.can_*`

| Colonne | Type | Défaut |
|---------|------|--------|
| `can_use` | boolean | false |
| `can_manage` | boolean | false |
| `can_grant` | boolean | false |
| `can_delegate` | boolean | false |

> **Migration P1.3.1** : Anciennes permissions → `can_use = true` (historique). Les 3 autres = `false` jusqu'à attribution explicite.

---

## Matrice de décision d'accès

| Ressource | `access_audience` | `access_permission` | `access_scope` | Qui accède |
|-----------|-------------------|---------------------|----------------|------------|
| `/` (Accueil) | `public` | — | — | Tout le monde (anon + auth) |
| `/connexion` | `public` | — | — | Tout le monde |
| `/inscription` | `public` | — | — | Tout le monde |
| `/test` | `authenticated` | `assessment.take` | — | Connectés + perm |
| `/compte` | `authenticated` | `profile.view` | — | Connectés + perm |
| `/admin` | `role_based` | `results.view` | — | Admins (via rôle + perm) |
| `/super-admin` | `role_based` | `users.manage` | — | Super Admin |
| Feature "Modifier utilisateur" (sur page admin) | `role_based` | `users.edit` | `role:encadreur` | Admins + scope encadreur |

---

## Vérification côté frontend (UX only)

```js
// UserAuthContext
const { hasRole, hasPermission } = useUserAuth();

// Page/Feature visibility
const canShowPage = (page) => {
  switch (page.access_audience) {
    case 'public': return true;
    case 'authenticated': return !!session;
    case 'role_based': return hasPermission(page.access_permission);
  }
};

const canShowFeature = (feature) => {
  switch (feature.access_audience) {
    case 'public': return true;
    case 'authenticated': return !!session;
    case 'role_based': return hasPermission(feature.access_permission);
  }
};
```

> **Rappel** : Frontend = UX uniquement. Vraie sécurité = RLS + RPC + Edge Functions.

---

## Résumé des distinctions

| Concept | Question | Exemple valeurs | Où stocké |
|---------|----------|-----------------|-----------|
| **ROLE** | "Qui suis-je ?" | `admin`, `candidat` | `user_roles` |
| **AUTH STATE** | "Suis-je connecté ?" | `anonymous` / `authenticated` | Session Supabase |
| **ACCESS AUDIENCE** | "Qui peut voir ça ?" | `public` / `authenticated` / `role_based` | `pages.access_audience`, `features.access_audience` |
| **PERMISSION** | "Que puis-je faire ?" | `USE`/`MANAGE`/`GRANT`/`DELEGATE` | `role_permissions.can_*` + délégations |

---

## Règles d'or

| Règle | Explication |
|-------|-------------|
| `public` ≠ rôle | Un visiteur anonyme n'existe **jamais** dans `user_roles` |
| `authenticated` ≠ permission | Être connecté ≠ avoir une permission |
| Page ≠ Feature | Feature protégée ≠ page protégée |
| `MANAGE` ⇏ `GRANT` | Capacités indépendantes, pas d'héritage automatique |
| Rôle ≠ Permission | Rôle = conteneur. Permission = atome d'autorisation |

---

## Exemples concrets

| Ressource | `access_audience` | `access_permission` | Qui y accède |
|-----------|-------------------|---------------------|--------------|
| Page d'accueil `/` | `public` | — | Tout le monde (anon + auth) |
| Connexion `/connexion` | `public` | — | Tout le monde |
| Inscription `/inscription` | `public` | — | Tout le monde |
| Test `/test` | `authenticated` | `assessment.take` | Connectés + perm `assessment.take` |
| Mon compte `/compte` | `authenticated` | `profile.view` | Connectés + perm `profile.view` |
| Admin `/admin` | `role_based` | `results.view` | Rôle `admin`/`super_admin` + perm `results.view` |
| Super Admin `/super-admin` | `role_based` | `users.manage` | Rôle `super_admin` + perm `users.manage` |
| Feature "Voir dashboard admin" | `role_based` | `admin-dashboard-view` | Rôle `admin`/`super_admin` |
| Feature "Créer utilisateur" (page admin) | `role_based` | `users.manage` | Rôle `admin` + perm `users.manage` |

---

*Dernière mise à jour : 2026-09-15*