---
id: GUIDE-CONVENTIONS-001
title: Conventions de développement
category: guides
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - conventions
  - coding-standards
  - naming
---

# Conventions de développement

## Nommage

| Type | Convention | Exemple |
|------|------------|---------|
| Fichiers composants | `PascalCase.jsx` | `Button.jsx`, `SuperAdminDashboard.jsx` |
| Hooks | `useCamelCase.js` | `useAuth.js` |
| Utilitaires / lib | `kebab-case.js` | `storage.js`, `scoring.js` |
| Constantes | `UPPER_SNAKE_CASE` | `NAVY`, `DEFAULT_PAGES` |
| Variables / fonctions | `camelCase` | `fetchUsers`, `handleSubmit` |
| Composants React | `PascalCase` | `function Button()` |
| Props | `camelCase` | `onClick`, `isActive` |
| CSS classes (si utilisées) | `kebab-case` | `.btn-primary` |

---

## Structure des composants

### Fichier composant

```jsx
// src/components/ui/Button.jsx
import { ... } from '...';

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  disabled, 
  full, 
  type = 'button',
  ...rest 
}) {
  // 1. Hooks en premier
  const [state, setState] = useState(initial);
  
  // 2. Handlers
  const handleClick = (e) => {
    if (!disabled && onClick) onClick(e);
  };
  
  // 3. Computed values
  const className = `btn btn-${variant} btn-${size} ${full ? 'btn-full' : ''}`;
  
  // 4. Render
  return (
    <button
      type={type}
      className={className}
      onClick={handleClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
```

### Ordre dans les composants

1. **Imports** (externes → internes → relatifs)
2. **Constantes** (hors composant)
3. **Composant** : hooks → handlers → computed → render
4. **Export default** en bas

---

## Styles

### Design System (`src/lib/theme.js`)

```js
export const NAVY = "#1B2A4A";
export const GOLD = "#B8862B";
export const GOLD2 = "#D9A94A";
export const CREAM = "#F7F4EC";
export const INK = "#2A2A28";
export const MUTED = "#8A8578";
export const LINE = "#E4DFD0";
export const SANS = "'IBM Plex Sans', sans-serif";
export const SERIF = "'Fraunces', serif";
```

### Utilisation

```jsx
import { NAVY, GOLD, CREAM, INK, MUTED, LINE, SANS, SERIF } from "../../lib/theme.js";

const style = {
  background: CREAM,
  color: INK,
  fontFamily: SANS,
  border: `1px solid ${LINE}`,
};
```

> **Pas de CSS modules / Tailwind / styled-components**. Styles inline uniquement.

---

## Conventions React

### Hooks

```js
// Custom hook
export function useAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un UserAuthProvider");
  return ctx;
}
```

### Handlers

```jsx
// Nommage : handle + Action
const handleSubmit = (e) => { e.preventDefault(); ... };
const handleClick = (e) => { ... };
const handleChange = (e) => { setValue(e.target.value); };
```

### Props

```jsx
// Destructuring avec valeurs par défaut
export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  disabled = false, 
  full = false,
  type = 'button',
  ...rest  // spread pour attributs HTML natifs
}) { ... }
```

---

## Structure des fichiers

### Composant UI

```
src/components/ui/
├── Button.jsx
├── Button.stories.jsx     # Optionnel (Storybook)
└── index.js               # export { default } from './Button.jsx';
```

### Page

```
src/pages/
├── MaPage.jsx
└── MaPage.stories.jsx     # Optionnel
```

### Hook

```
src/hooks/
├── useAuth.js
└── index.js               # export { useAuth } from './useAuth';
```

### Utilitaire

```
src/lib/
├── storage.js
├── scoring.js
└── theme.js
```

---

## Imports

### Ordre

```jsx
// 1. Externes (React, libs)
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { ChevronRight } from "lucide-react";

// 2. Internes (contextes, hooks, utils)
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { formatDate } from "../lib/candidates.js";

// 3. Composants UI
import Button from "../components/ui/Button.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";

// 4. Styles / assets
import icon from "../assets/icon.svg";
```

### Alias (vite.config.js)

```js
// vite.config.js
export default defineConfig({
  resolve: {
    alias: {
      "@": "/src",
      "@components": "/src/components",
      "@lib": "/src/lib",
      "@context": "/src/context",
      "@pages": "/src/pages",
    },
  },
});
```

Usage : `import Button from "@components/ui/Button.jsx"`

---

## Git & Commits

### Messages de commit (Conventional Commits)

| Type | Usage | Exemple |
|------|-------|---------|
| `feat` | Nouvelle fonctionnalité | `feat: ajout page Super Admin Dashboard` |
| `fix` | Correction bug | `fix: correction calcul score B7` |
| `docs` | Documentation | `docs: mise à jour README installation` |
| `style` | Formatage (lint, prettier) | `style: formatage prettier src/pages` |
| `refactor` | Refactor sans changement fonctionnel | `refactor: extraction hook useAuth` |
| `perf` | Performance | `perf: optimisation calcul scoring B7` |
| `test` | Tests | `test: ajout tests unitaires scoring` |
| `chore` | Maintenance (deps, config) | `chore: mise à jour deps pnpm` |
| `build` | Build system | `build: mise à jour vite.config` |
| `ci` | CI/CD | `ci: ajout job lint GitHub Actions` |

### Format

```
<type>(<scope>): <description>

[body optionnel]

[footer optionnel]
```

Exemple :
```
feat(super-admin): ajout page gestion des fonctionnalités

Ajoute la page SuperAdminFeatures avec CRUD complet
et liaison page_features.

Closes #123
```

---

## Linting & Formatting

### ESLint

```bash
pnpm run lint
```

Config : `eslint.config.js` (eslint-plugin-react-hooks, react-refresh)

### Prettier (si configuré)

```bash
pnpm exec prettier --write .
```

---

## Git Workflow

### Branches

| Branche | Protection | Usage |
|---------|------------|-------|
| `main` | ✅ Protected | Production |
| `develop` | ✅ Protected | Intégration |
| `feature/*` | — | Nouvelles features |
| `fix/*` | — | Corrections |
| `docs/*` | — | Documentation |

### Pull Request

1. Base : `develop`
2. Title : Conventional Commit
3. Description : Quoi + Pourquoi + Comment tester
4. Review : 1 approbation minimum
3. Checks : `lint` + `build` passent
4. Merge : Squash and merge

---

## Documentation

### JSDoc (pour hooks/utils exportés)

```js
/**
 * Calcule les scores de dimensions à partir des réponses.
 * @param {Object} responses - Réponses { mcq, b7, b8 }
 * @returns {Object} Scores par dimension { [dimKey]: score }
 */
export function computeDimensionScores(responses) { ... }
```

### README composant (optionnel)

```markdown
# Button

Bouton réutilisable avec variants et tailles.

## Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| variant | 'primary' \| 'outline' \| 'ghost' \| 'danger' | 'primary' | Style visuel |
| size | 'sm' \| 'md' \| 'lg' | 'md' | Taille |
| full | boolean | false | Largeur 100% |
| onClick | function | — | Handler clic |

## Exemple

```jsx
<Button variant="primary" onClick={handleClick}>
  Valider
</Button>
```
```

---

*Dernière mise à jour : 2026-09-15*