---
id: REF-CONFIGURATION-001
title: Configuration
category: reference
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - configuration
  - environment
  - settings
---

# Configuration

---

## Variables d'environnement

### Frontend (`.env`)

```env
# Supabase (obligatoire)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Admin local (développement uniquement)
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=change-me
```

| Variable | Requis | Description |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | Oui | URL projet Supabase (ex: `https://abc.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Oui | Clé publique (anon key) Supabase |
| `VITE_AUTH_USERNAME` | Non (dev) | Username admin local pour `/login` |
| `VITE_AUTH_PASSWORD` | Non (dev) | Password admin local pour `/login` |

> **Important** : `.env` est dans `.gitignore`. Ne jamais commiter les vraies valeurs.

### Exemple `.env.example`

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here

# Admin local (dev only - ne pas utiliser en production)
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=change-me
```

---

## Configuration Vite (`vite.config.js`)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@lib': '/src/lib',
      '@context': '/src/context',
      '@pages': '/src/pages',
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
```

**Alias configurés :**
| Alias | Chemin |
|-------|--------|
| `@` | `/src` |
| `@components` | `/src/components` |
| `@lib` | `/src/lib` |
| `@context` | `/src/context` |
| `@pages` | `/src/pages` |

---

## Configuration ESLint (`eslint.config.js`)

```js
export default [
  // ... config React + React Hooks + React Refresh
  {
    rules: {
      'react-refresh/only-export-components': 'off', // Pour contextes
      'no-unused-vars': 'warn',
    },
  },
];
```

**Scripts package.json :**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  }
}
```

---

## Configuration Supabase

### Dashboard → Authentication

| Setting | Valeur recommandée |
|---------|-------------------|
| Site URL | `https://votre-domaine.com` (prod) / `http://localhost:5173` (dev) |
| Redirect URLs | `https://votre-domaine.com/reinitialiser-mot-de-passe` |
| Email confirmation | **Enabled** |
| Email auth provider | Enabled |
| Phone auth | Disabled (sauf besoin) |
| MFA | Disabled (sauf besoin) |

### Database → RLS

- RLS activée sur **toutes** les tables `public.*`
- Policies restrictives (pas `USING(true)` sur tables sensibles)
- Index sur FK + colonnes `expires_at` / `revoked_at`

### Edge Functions

| Function | Status | Secrets requis |
|----------|--------|----------------|
| `admin-reset-password` | Deployed | `SUPABASE_SERVICE_ROLE_KEY` (auto) |

### API Settings

| Setting | Valeur |
|---------|--------|
| Rate limiting | Configuré selon charge |
| CORS | Domaines autorisés seulement |
| Webhooks | Non configurés (pour l'instant) |

---

## Variables Supabase Dashboard (Edge Functions)

| Variable | Description | Source |
|----------|-------------|--------|
| `SUPABASE_URL` | URL projet | Auto-injecté |
| `SUPABASE_ANON_KEY` | Clé anon | Auto-injecté |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role | Auto-injecté (Edge Functions only) |

> **Important** : `SUPABASE_SERVICE_ROLE_KEY` **jamais** dans le frontend. Uniquement dans Edge Functions via variables d'env Supabase.

---

## Configuration Build

### Scripts `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  }
}
```

### Commandes utiles

| Commande | Description |
|----------|-------------|
| `pnpm run dev` | Serveur dev (HMR) sur `http://localhost:5173` |
| `pnpm run build` | Build production dans `dist/` |
| `pnpm run preview` | Prévisualise build production |
| `pnpm run lint` | ESLint sur tout le projet |

---

## Supabase CLI

### Commandes principales

```bash
# Lier projet local à distant
supabase link --project-ref <project-ref>

# Appliquer migrations vers distant
supabase db push

# Créer nouvelle migration
supabase migration new nom_migration

# Déployer Edge Functions
supabase functions deploy admin-reset-password

# Générer types TypeScript (si TS)
supabase gen types typescript --project-id <ref> > src/types/supabase.ts
```

### Variables d'env Supabase CLI

```bash
# Dans .env.local (pas commité)
SUPABASE_ACCESS_TOKEN=your-access-token
```

---

## Configuration Git

### `.gitignore` (extrait)

```gitignore
# Dependencies
node_modules/

# Build
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp

# Supabase
supabase/.temp/

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db
```

---

## Configuration IDE (VS Code recommandé)

### Extensions recommandées (`.vscode/extensions.json`)

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### Settings (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## Variables d'environnement par environnement

### Développement (`.env`)

```env
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=dev-password
```

### Staging (Vercel Environment Variables)

```env
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Production (Vercel Environment Variables)

```env
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Pas de VITE_AUTH_USERNAME/PASSWORD en prod
```

---

## Checklist configuration

| Item | Dev | Staging | Prod |
|------|-----|---------|------|
| `VITE_SUPABASE_URL` | ☐ | ☐ | ☐ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ☐ | ☐ | ☐ |
| `VITE_AUTH_USERNAME/PASSWORD` | ☐ | ❌ | ❌ |
| Supabase Auth config | ☐ | ☐ | ☐ |
| RLS activées | ☐ | ☐ | ☐ |
| Edge Functions déployées | ☐ | ☐ | ☐ |
| Rate limiting | ☐ | ☐ | ☐ |
| CSP / Security headers | ☐ | ☐ | ☐ |

---

*Dernière mise à jour : 2026-09-15*