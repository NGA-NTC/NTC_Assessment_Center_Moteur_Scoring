---
id: GUIDE-DEVELOPMENT-001
title: Guide de développement
category: guides
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - development
  - workflow
  - local
---

# Guide de développement

## Démarrage rapide

```bash
# Terminal 1: Frontend dev server
pnpm run dev
# → http://localhost:5173

# Terminal 2 (optionnel): Supabase local (si utilisé)
supabase start
# → Studio: http://localhost:54323
```

## Structure de travail

### Branches

| Branche | Usage |
|---------|-------|
| `main` | Production (protected) |
| `develop` | Intégration continue |
| `feature/*` | Nouvelles fonctionnalités |
| `fix/*` | Corrections |
| `docs/*` | Documentation seulement |

### Workflow feature

```bash
# 1. Depuis develop
git checkout develop
git pull origin develop
git checkout -b feature/ma-fonctionnalite

# 2. Développement
# ... code ...

# 3. Vérifications
pnpm run lint
pnpm run build

# 4. Commit + Push
git add .
git commit -m "feat: description claire"
git push origin feature/ma-fonctionnalite

# 5. Pull Request vers develop
```

---

## Architecture du code

### Points d'entrée

| Fichier | Rôle |
|---------|------|
| `src/main.jsx` | Point d'entrée React |
| `src/routes/index.jsx` | Routes + guards |
| `src/context/UserAuthContext.jsx` | Auth candidat + roles/permissions |
| `src/context/AdminAuthContext.jsx` | Auth admin |

### Contextes clés

| Contexte | Fichier | Expose |
|----------|---------|--------|
| `UserAuthContext` | `src/context/UserAuthContext.jsx` | `user`, `session`, `profile`, `roles`, `permissions`, `hasRole`, `hasPermission`, `login`, `logout`, `register` |
| `AdminAuthContext` | `src/context/AdminAuthContext.jsx` | `isAuthenticated`, `adminUser`, `login`, `logout` |

### Guards de routing

| Guard | Fichier | Vérifie | Redirection |
|-------|---------|---------|-------------|
| `UserRoute` | `UserRoute.jsx` | `user` existe | `/connexion` |
| `ProtectedRoute` | `ProtectedRoute.jsx` | `isAuthenticated` (admin) | `/login` |
| `SuperAdminRoute` | `SuperAdminRoute.jsx` | `hasRole('super_admin')` | `/login` |

---

## Composants

### Création d'un composant UI

```
src/components/ui/
├── MonComposant.jsx
├── MonComposant.stories.jsx (optionnel)
└── index.js (export)
```

**Conventions :**
- Props typées en JSDoc
- Styles inline (design system `theme.js`)
- Accessibilité (aria-*, focus-visible)
- Responsive (mobile-first)

### Composants de question

```
src/components/question/
├── McqBattery.jsx        # QCM (B1-B6)
├── RubricBattery.jsx     # Cas + grille (B7)
├── CoherenceBattery.jsx  # Simulations (B8)
├── QuestionCard.jsx      # Affichage question
├── OptionButton.jsx      # Bouton réponse QCM
├── IntensityToggle.jsx   # B8: léger/modéré/fort
└── ResponsesReview.jsx   # Relecture admin
```

---

## Routing

### Ajout d'une route

1. Créer la page dans `src/pages/`
2. Ajouter dans `src/routes/index.jsx` :

```jsx
import MaPage from "../pages/MaPage.jsx";

<Route
  path="/ma-route"
  element={
    <UserRoute>  {/* ou ProtectedRoute / SuperAdminRoute */}
      <MaPage />
    </UserRoute>
  }
/>
```

### Guards disponibles

| Guard | Import | Usage |
|-------|--------|-------|
| `UserRoute` | `UserRoute.jsx` | Candidat connecté |
| `ProtectedRoute` | `ProtectedRoute.jsx` | Admin (admin/super_admin) |
| `SuperAdminRoute` | `SuperAdminRoute.jsx` | Super Admin uniquement |

---

## State Management

### Contextes (pas de Redux/Zustand)

| Contexte | Fichier | Usage |
|----------|---------|-------|
| `UserAuthContext` | `UserAuthContext.jsx` | Auth candidat + rôles/perms |
| `AdminAuthContext` | `AdminAuthContext.jsx` | Auth admin |

### localStorage (via `src/lib/storage.js`)

| Clé | Contenu |
|-----|---------|
| `ntc_users` | Comptes candidats + réponses |
| `ntc_imported` | Imports JSON + métadonnées |
| `ntc_auth` | Session admin |
| `ntc_user_session` | Session candidat |

> Fonctions : `storeGet(key)`, `storeSet(key, value)` → fallback `localStorage` si `window.storage` absent.

---

## Tests

### Actuel

- Pas de tests automatisés configurés
- Vérification manuelle : `pnpm run dev` + `pnpm run build`
- Lint : `pnpm run lint`

### À venir (PLANNED)

- Unit tests : Vitest + React Testing Library
- E2E : Playwright
- CI : GitHub Actions

---

## Debugging

### Outils

| Outil | Usage |
|-------|-------|
| React DevTools | Composants, props, state |
| Supabase Dashboard | Logs Auth, DB, Edge Functions, RPC |
| Console navigateur | Logs frontend, erreurs |
| Network tab | Requêtes Supabase, Edge Functions |

### Logs utiles

```js
// Frontend
console.log('UserAuthContext:', user, roles, permissions);

// Supabase RPC
const { data, error } = await supabase.rpc('nom_fonction', { params });

// Edge Function logs
// Dashboard Supabase → Edge Functions → Logs
```

---

## Conventions de code

### Fichiers

| Type | Convention |
|------|------------|
| Composants | `PascalCase.jsx` (`Button.jsx`) |
| Hooks | `useCamelCase.js` (`useAuth.js`) |
| Utilitaires | `kebab-case.js` (`storage.js`) |
| Constantes | `UPPER_SNAKE_CASE` |

### Code

```jsx
// Composant fonctionnel
export default function MonComposant({ prop1, prop2 }) {
  // Hooks en premier
  const [state, setState] = useState(initial);
  
  // Handlers
  const handleClick = () => { ... };
  
  // Render
  return (
    <div className="mon-composant">
      {/* JSX */}
    </div>
  );
}
```

### Styles

- **Inline styles** (design system `theme.js`)
- Pas de CSS modules / Tailwind / styled-components
- Variables thème : `NAVY`, `GOLD`, `CREAM`, `INK`, `MUTED`, `LINE`, `SANS`, `SERIF`

---

## Commandes de développement

```bash
# Dev server
pnpm run dev          # http://localhost:5173

# Build
pnpm run build        # dist/
pnpm run preview      # Preview build

# Lint
pnpm run lint         # ESLint

# Type check (si TypeScript)
# pnpm run typecheck

# Supabase local
supabase start        # DB locale + Studio
supabase stop
supabase db reset     # Reset DB locale (⚠️ détruit données)
supabase db push      # Push migrations vers distant
```

---

## Dépannage courant

| Problème | Cause probable | Solution |
|----------|----------------|----------|
| Page blanche au chargement | Erreur JS au mount | Console navigateur → stack trace |
| Guard bloque accès | Role/permission manquant | Vérifier `user_roles` + `role_permissions` |
| RPC 403/500 | Permission manquante | Vérifier `has_permission` / RLS |
| Edge Function 401 | Token invalide/expiré | Re-login, vérifier token |
| Build échoue | Erreur syntaxe / import | `pnpm run build` → lire erreur |
| Hot reload ne marche pas | Cache Vite | `rm -rf node_modules/.vite && pnpm run dev` |

---

*Dernière mise à jour : 2026-09-15*