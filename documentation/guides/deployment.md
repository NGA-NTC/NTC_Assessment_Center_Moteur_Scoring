---
id: GUIDE-DEPLOYMENT-001
title: Guide de déploiement
category: guides
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - deployment
  - production
  - vercel
  - supabase
---

# Guide de déploiement

## Environnements

| Environnement | URL | Branche | Base |
|---------------|-----|---------|------|
| Développement | `http://localhost:5173` | `develop` | Supabase local / distant dev |
| Staging | `https://staging-ntc.vercel.app` | `develop` | Supabase staging |
| Production | `https://ntc-assessment.com` | `main` | Supabase prod |

---

## Build de production

```bash
# 1. Build
pnpm run build
# → génère dist/

# 2. Test local du build
pnpm run preview
# → http://localhost:4173
```

### Variables d'env production

```env
# .env.production
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Pas de VITE_AUTH_USERNAME/PASSWORD en prod (backend dédié)
```

---

## Déploiement Vercel (recommandé)

### Configuration Vercel

1. **Import repo** sur Vercel
2. **Build Command** : `pnpm run build`
3. **Output Directory** : `dist`
4. **Install Command** : `pnpm install`
5. **Environment Variables** (dans Vercel Dashboard → Settings → Environment Variables) :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

### Configuration `vercel.json`

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  }
```

### Déploiement automatique

| Branche | Environnement | Déclencheur |
|---------|---------------|-------------|
| `main` | Production | Push sur `main` |
| `develop` | Preview | Push sur `develop` / PR vers `develop` |

---

## Déploiement Supabase

### Migrations

```bash
# Vers projet distant lié
supabase db push

# Ou via Dashboard SQL Editor
# Copier migrations dans l'ordre chronologique
```

### Edge Functions

```bash
# Déploiement
supabase functions deploy admin-reset-password

# Variables d'env (auto-injectées par Supabase)
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### Vérification post-déploiement

```bash
# Vérifier migrations appliquées
supabase migration list

# Tester Edge Function
curl -X POST https://<project>.supabase.co/functions/v1/admin-reset-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"target_user_id": "uuid"}'
```

---

## Configuration Supabase Dashboard (Production)

### Authentication

| Setting | Valeur |
|---------|--------|
| Site URL | `https://votre-domaine.com` |
| Redirect URLs | `https://votre-domaine.com/reinitialiser-mot-de-passe` |
| Email confirmation | **Enabled** |
| Email auth | Enabled |
| Phone auth | Disabled (sauf besoin) |

### Database

- RLS activées sur toutes tables `public.*`
- Policies restrictives (pas `USING(true)` sur tables sensibles)
- Index sur FK + colonnes `expires_at` / `revoked_at`

### Edge Functions

| Function | Status | Secrets |
|----------|--------|---------|
| `admin-reset-password` | Deployed | `SUPABASE_SERVICE_ROLE_KEY` (auto) |

### API Settings

- Rate limiting : Configuré selon charge attendue
- CORS : Domaines autorisés seulement

---

## Checklist pré-production

| Item | Vérifié |
|------|---------|
| Build passe (`pnpm run build`) | ☐ |
| Lint passe (`pnpm run lint`) | ☐ |
| Variables `.env.production` configurées sur Vercel | ☐ |
| Migrations appliquées sur Supabase prod | ☐ |
| Edge Functions déployées | ☐ |
| Supabase Auth config (Site URL, Redirect URLs) | ☐ |
| RLS activées sur toutes tables | ☐ |
| Pas de `service_role` dans frontend | ☐ |
| Rate limiting configuré | ☐ |
| CSP / headers sécurité configurés | ☐ |
| Monitoring / alertes configurés | ☐ |

---

## Rollback

### Vercel

```bash
# Via Dashboard Vercel → Deployments → ... → Rollback
# Ou CLI
vercel rollback <deployment-url>
```

### Supabase

```bash
# Migration rollback (si migration réversible)
supabase db reset --linked  # ⚠️ DANGER: détruit données

# Ou migration inverse manuelle via SQL Editor
```

### Base de données

```bash
# Backup avant déploiement majeur
supabase db dump --schema public > backup_$(date +%Y%m%d).sql

# Restore
psql -h <host> -U postgres -d postgres < backup_20260915.sql
```

---

## Monitoring post-déploiement

| Métrique | Outil | Alerte |
|----------|-------|--------|
| Erreurs 5xx | Vercel Analytics / Logs | > 1% |
| Latence p95 | Vercel Analytics | > 2s |
| Erreurs Edge Functions | Supabase Dashboard → Logs | > 0 |
| Erreurs RPC | Supabase Dashboard → Logs | > 0 |
| Auth failures | Supabase Dashboard → Auth | Pic inhabituel |

---

*Dernière mise à jour : 2026-09-15*