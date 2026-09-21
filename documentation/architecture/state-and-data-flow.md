---
id: ARCH-STATE-FLOW-TARGET-001
title: État et flux de données — Cible
category: architecture
status: designed
version: 1.0.0
created_at: 2026-09-18
updated_at: 2026-09-18
source_of_truth: true
tags:
  - state
  - data-flow
  - contexts
  - hooks
  - services
  - architecture-cible
---

# État et flux de données — Cible

## 1. Principe général

```
Pages / Composants
      │  (état local React + hooks UI)
      ▼
Hooks (par domaine : auth/, rbac/, data/, navigation/)
      │  (consomment les services, exposent l'état aux composants)
      ▼
Services (couche unique d'accès à Supabase / stockage)
      │
      ▼
Backend (Supabase : auth, tables, RLS, RPC) — source de vérité
```

- Les composants **n'accèdent jamais directement à Supabase** : ils passent par `hooks` → `services`.
- Les hooks contiennent la logique d'orchestration (mutation → rafraîchissement, cache, état de chargement) mais **pas toute la logique backend**.
- Un seul point d'accès `lib/supabaseClient.js` reste partagé par les services.
- Le « storage local » (`window.storage` / `localStorage`) n'est utilisé que **temporairement** pour les données à migrer (comptes/imports/réponses), jamais pour l'autorisation.

## 2. Contextes cibles

### Contexte d'authentification unique
L'état actuel est éclaté entre `UserAuthContext` et `AdminAuthContext`, **deux contextes qui souscrivent chacun à `onAuthStateChange`** et qui se redéclarent partiellement (`login`/`logout`).

**Cible** : un seul `AuthContext` qui expose :
- `user`, `session`, `profile`, `loading`
- `roles`, `permissions`, `capabilities`
- `hasRole(roleId)`, `hasPermission(permId)`, `hasCapability(cap)` — helper **UI/UX** uniquement
- `register`, `login`, `logout`, `resetPassword`, `updatePassword`, `updateProfile`, `refreshAuthData`

La distinction « admin / super admin / candidat » n'est plus des booléens stockés : elle est dérivée des rôles/permissions fournis par le backend. Le composant `Login` (admin) et `UserLogin` (candidat) fusionnent ; la redirection post-connexion dépend des rôles/permissions (backend).

### Autres contextes cibles
| Contexte | Rôle | Fil |
|----------|------|-----|
| `AuthContext` | session, profil, rôles, permissions | Supabase auth + tables `profiles`/`user_roles`/`role_permissions` |
| `I18nContext` | langue courante, résolution `t(key, params)` | `i18n/` |
| `NavigationContext` | état de navigation dynamique (sidebar, route courante, config) | `routes/` + `services/` (ou Supabase plus tard) |
| (optionnel) `NotificationsContext` | messages flash globaux | `FlashMessage` |

## 3. Flux de données par domaine

### Authentification (cible)
```
AuthContext.login(email, password)
   → services/auth.login(email, password)
       → supabase.auth.signInWithPassword
       → sur succès : chargement profil + rôles + permissions (services/users, services/roles/services/rbac)
       → AuthContext met à jour user/roles/permissions
   → redirection par rôle (route cible via route registry)
```

### Autorisation (RBAC) — rappel sécurité
- Les permissions affichées/cachées dans le frontend proviennent des données chargées (backend). Le **gating réel** reste côté Supabase (RLS/RPC) — ADR-001.
- Les mutations sensibles passent par des **RPC/Security Definer** (jamais par des opérations CRUD directes exposées dans le frontend, une fois le backend branché). À ce stade (avant migration), certaines pages Super Admin font encore des `supabase.from(...).insert/update/delete` directs — dette à traiter lors de la phase services/rbac.

### Résultats / scoring (cible)
```
TestApp → hooks/assessment → services/assessments (sauvegarde réponses)
AdminResultats → hooks/results → services/results
   ├── lists (comptes + imports)        → services/candidates
   ├── scoring (dims, axes, métiers)    → utils/score (moteur pur, déplacé depuis lib/scoring.js)
   ├── export JSON/PDF                  → services/export (module unique, plus de code mort)
   └── base de données                  → plus tard : migration localStorage → Supabase
```

### Niveaux de flux à concevoir proprement
1. **UI state** : états locaux de formulaire, modales, filtres (React `useState`/`useReducer` dans les pages).
2. **Server state** : données Supabase → hooks `data/` (`useUsers`, `useRoles`, `useAccounts`, `useResults`) avec états `loading/error/data`, refresh après mutation.
3. **App state** : sessions, langue, navigation → contextes.

## 4. État des données persistantes (dette & migration)

### Actuel (localStorage via `lib/storage.js`)
| Clé | Contenu | Destin |
|-----|---------|--------|
| `ntc_users` | comptes candidats + réponses | → Supabase (phase P1.4/P1.5 roadmap) |
| `ntc_imported` | imports runtime | → Supabase (phase P1.5) |
| `reponses/*.json` + `${racine}/reponses/*.json` | imports statiques (`import.meta.glob`) | → Supabase (fichiers de référence) |

### Cible
- `storage.js` est **décomposé** par domaine dans `services/` :
  - `services/candidates/` (fabrication de candidats : comptes + imports + scoring) — depuis `lib/candidates.js`
  - `services/import/` (normalisation `normalizeResponses`, parsing `parseCandidateImport`, liste statique `imported.js`)
  - `services/accounts/` (comptes temporaires localStorage, en attendant Supabase)
- Le **moteur de scoring** (`lib/scoring.js`) devient `utils/score/` (fonctions pures : `calculateScore`, `computeCoherence`, `computeRoleFit`, `generateReport`, `progress`, `normalizeScore`) — testable sans React ni Supabase.
- `lib/theme.js` : **non modifié** (décision utilisateur).

## 5. Gestion d'erreurs et de chargement (cible)
- Composants partagés `LoadingScreen`, `FlashMessage`, `ErrorState` (voir `component-architecture.md`).
- Modèle cohérent `{ data, loading, error }` renvoyé par chaque hook `data/`.
- Plus de `console.error` dispersés ni de messages flash recopiés.

## 6. Points d'attention (violations actuelles à corriger en refactorisation)
- Double souscription `onAuthStateChange` (UserAuthContext + AdminAuthContext).
- Imports directs `supabase` dans les pages (AdminUsers, SuperAdmin*, AdminUserDetail) → à passer sous services + hooks.
- Requêtes SQL fragmentaires et rôles hardcodés dans les requêtes (ex. `.in("role_id", ["admin","super_admin"])`).

---

*Dernière mise à jour : 2026-09-18*