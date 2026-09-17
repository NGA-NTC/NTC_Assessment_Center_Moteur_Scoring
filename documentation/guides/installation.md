---
id: GUIDE-INSTALLATION-001
title: Guide d'installation
category: guides
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - installation
  - setup
  - getting-started
---

# Guide d'installation

## Prérequis

| Outil | Version minimale | Vérification |
|-------|------------------|--------------|
| Node.js | 18+ | `node --version` |
| pnpm | 8+ | `pnpm --version` |
| Git | 2.x | `git --version` |

## Installation

```bash
# 1. Cloner le repo
git clone <repo-url>
cd NTC_Assessment_Center_Moteur_Scoring

# 2. Installer les dépendances
pnpm install

# 3. Configuration environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Démarrer en développement
pnpm run dev
```

## Variables d'environnement (`.env`)

```env
# Supabase (obligatoire)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Admin local (optionnel - pour dev)
VITE_AUTH_USERNAME=admin
VITE_AUTH_PASSWORD=change-me
```

> **Note** : `.env` est dans `.gitignore`. Ne jamais commiter les vraies valeurs.

## Configuration Supabase

### 1. Projet Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Récupérer `Project URL` et `anon key` dans Settings → API
3. Les mettre dans `.env`

### 2. Migrations

```bash
# Option A: Via Supabase CLI (recommandé)
supabase db push

# Option B: Via Dashboard SQL Editor
# Copier-coller chaque fichier migration dans l'ordre
```

### 3. Edge Functions

```bash
# Déployer la fonction admin-reset-password
supabase functions deploy admin-reset-password
```

### 4. Configuration Auth

Dans Supabase Dashboard → Authentication → Settings :
- Site URL : `http://localhost:5173` (dev) / URL prod
- Redirect URLs : `http://localhost:5173/reinitialiser-mot-de-passe` (dev)
- Email confirmation : **Activé**

---

## Vérification

```bash
# Build de production
pnpm run build

# Lint
pnpm run lint

# Preview build
pnpm run preview
```

## Structure attendue après install

```
.
├── node_modules/
├── dist/                    # Après build
├── supabase/
│   ├── migrations/          # 8 fichiers .sql
│   └── functions/
│       └── admin-reset-password/
├── src/
├── .env                     # Votre config locale
├── .env.example             # Template
└── package.json
```

## Problèmes courants

| Problème | Solution |
|----------|----------|
| `pnpm install` échoue | Vérifier Node ≥ 18, supprimer `node_modules` + `pnpm-lock.yaml` et réinstaller |
| Erreur Supabase connection | Vérifier `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans `.env` |
| Migration échoue | Vérifier ordre migrations (ordre chronologique), Supabase status |
| Edge Function 401/403 | Vérifier `SUPABASE_SERVICE_ROLE_KEY` dans Dashboard Edge Functions |
| Admin login échoue | Vérifier rôle `admin` ou `super_admin` dans `user_roles` |

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `pnpm run dev` | Serveur dev (HMR) sur `http://localhost:5173` |
| `pnpm run build` | Build production dans `dist/` |
| `pnpm run preview` | Prévisualise build production |
| `pnpm run lint` | ESLint sur tout le projet |
| `supabase db push` | Applique migrations locales vers distant |
| `supabase db reset` | Reset DB locale (attention: détruit données) |
| `supabase functions deploy` | Déploie Edge Functions |

---

*Dernière mise à jour : 2026-09-15*