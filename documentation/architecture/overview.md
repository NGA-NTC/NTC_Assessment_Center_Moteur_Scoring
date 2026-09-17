---
id: ARCH-OVERVIEW-001
title: Vue d'ensemble de l'architecture
category: architecture
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - architecture
  - overview
  - stack
---

# Vue d'ensemble de l'architecture NTC

## Résumé

NTC Assessment Center est une **Single Page Application (SPA)** 100% côté client, construite avec **React 19 + Vite 8 + React Router 7**. Elle utilise **Supabase** comme backend (Auth, Database, Edge Functions) mais **toute la logique métier réside dans le navigateur**.

## Composants principaux

| Composant | Technologie | État |
|-----------|-------------|------|
| **Frontend** | React 19 + Vite 8 + React Router 7 | IMPLEMENTED |
| **Auth** | Supabase Auth (email/password) | IMPLEMENTED |
| **Database** | PostgreSQL (Supabase) | IMPLEMENTED |
| **Edge Functions** | Deno (admin-reset-password) | IMPLEMENTED |
| **RPC** | PL/pgSQL (SECURITY DEFINER) | IMPLEMENTED |
| **Stockage local** | localStorage / window.storage | IMPLEMENTED |

## Flux principaux

### 1. Authentification candidat
```
/connexion → UserLogin → UserAuthContext → Supabase Auth → /test
```

### 2. Authentification administrateur
```
/login → Login → AdminAuthContext → ProtectedRoute → /admin
```

### 3. Super Admin
```
/super-admin → SuperAdminRoute (hasRole super_admin) → SuperAdminLayout → Pages Super Admin
```

### 4. Passage du test
```
/test → TestApp → Sidebar (batteries) → Batteries (McqBattery, RubricBattery, CoherenceBattery) → Sauvegarde localStorage
```

## Architecture des contextes

```
AppRoutes
├── UserAuthProvider (UserAuthContext)
│   ├── user, session, profile, roles, permissions
│   ├── hasRole(), hasPermission()
│   └── login, logout, register, resetPassword
└── AdminAuthProvider (AdminAuthContext)
    ├── isAuthenticated, adminUser
    ├── checkAdmin() → user_roles (admin/super_admin)
    └── login, logout
```

## Séparation frontend / backend

| Frontend (Navigateur) | Backend (Supabase) |
|----------------------|-------------------|
| UI React complète | Auth (email/password, JWT) |
| Logique métier (scoring, routing) | Database (PostgreSQL + RLS) |
| localStorage (candidats, imports) | Edge Functions (admin-reset-password) |
| Guards de routing | RPC SECURITY DEFINER |
| Calculs de scoring | Edge Function admin-reset-password |

> **Principe** : Le frontend n'est **pas** une frontière de sécurité. Toute la sécurité réelle est côté Supabase (RLS, RPC SECURITY DEFINER, Edge Functions avec service_role).

## Dépendances principales

| Dépendance | Version | Usage |
|------------|---------|-------|
| React | 19.2.8 | UI |
| React Router | 7.18.3 | Routing + Guards |
| Vite | 8.2.2 | Build / Dev server |
| Supabase JS | 2.x | Client Supabase |
| recharts | 3.10.1 | Graphiques radar |
| lucide-react | 1.41.0 | Icônes |

## Flux de données candidat

```
Inscription → Supabase Auth → Trigger handle_new_user()
    → profiles (email) + user_roles (candidate)
    ↓
Connexion → UserAuthContext → fetchProfile + fetchRoles
    → roles = ['candidate'] + permissions (profile.view, profile.edit, assessment.take)
    ↓
/test → TestApp → Batteries (B1-B8) → Réponses en localStorage (ntc_users)
    ↓
Sauvegarde auto (debounce 400ms) → localStorage
```

## Flux administrateur

```
Connexion /login → AdminAuthContext.checkAdmin()
    → user_roles (admin/super_admin) → isAuthenticated = true
    ↓
/admin → ProtectedRoute → AdminResultats
    → localStorage (ntc_users, ntc_imported) → buildCandidates()
    → Liste + filtres + détail + export PDF/JSON
```

## Super Admin (étendu)

```
/super-admin → SuperAdminRoute (hasRole super_admin) → SuperAdminLayout
    ├── /super-admin (Dashboard + stats via admin_get_users RPC)
    ├── /super-admin/comptes (admin_get_users RPC + CRUD utilisateurs)
    ├── /super-admin/roles (CRUD roles + permissions)
    ├── /super-admin/acces (role_delegations + permissions)
    ├── /super-admin/pages (CRUD pages + features)
    └── /super-admin/fonctionnalites (CRUD features + page_features)
```

## Sécurité : principe fondamental

> **Le frontend n'est JAMAIS une frontière de sécurité.**

Toute la sécurité réelle réside dans :
- **RLS** (Row Level Security) sur toutes les tables
- **RPC SECURITY DEFINER** pour mutations complexes
- **Edge Functions** avec `service_role` pour opérations Admin Auth
- **RLS** sur tables de délégation (super_admin only)

Le frontend ne fait qu'**afficher/masquer** des éléments selon `hasRole`/`hasPermission` — ce n'est qu'une UX, pas une protection.

---

*Dernière mise à jour : 2026-09-15*