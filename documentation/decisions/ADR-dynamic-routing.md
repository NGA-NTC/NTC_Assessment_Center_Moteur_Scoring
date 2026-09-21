---
id: ADR-005
title: Routage dynamique — séparation route_key / path / composant / configuration / autorisation
status: proposed
date: 2026-09-18
category: decisions
tags:
  - routing
  - registry
  - supabase
  - navigation
---

# ADR-005 : Routage dynamique

## Statut
**Proposed** — 2026-09-18 (en attente de validation)

## Contexte

`src/routes/index.jsx` déclare toutes les routes en dur : chemins par rôle (`/super-admin/*`, `/admin/*`), guards copiés 3 fois, navigation hardcodée dans `SuperAdminSidebar`, titres de pages hardcodés dans chaque page. Supabase stocke déjà des tables `pages`/`features` ; il faut une architecture qui sépare clairement le code des faits de configuration, sans coupler le frontend à du code backend.

## Décision

Séparer **5 couches** :

1. **`route_key`** — clé technique stable, non affichée (ex. `"access-control"`).
2. **`path`** — URL publique, **sans rôle** (ex. `/acces`, `/comptes`, `/roles`, `/resultats`, `/test`, `/compte`).
3. **Composant React** — uniquement dans le frontend (jamais référencé/stocké côté Supabase).
4. **Configuration / navigation** — `titleKey`, `section`, `order`, `navigation_visible`, `parent`, `audience` (les métadonnées peuvent, plus tard, être pilotées par Supabase).
5. **Autorisation réelle** — Supabase (RBAC / RLS / RPC), source de vérité.

### Répartition des responsabilités
```
FRONTEND :  route_key + path + composant + métadonnées de nav (registry)
SUPABASE :  configuration dynamique : route_key, enabled, navigation_visible, section, order, parent, audience
RBAC/RLS :  autorisation réelle (accès direct à l'URL toujours protégé)
```

- Une route peut exister dans le code sans être affichée si elle n'est pas activée/configurée côté backend.
- **Cacher une route n'est pas une sécurité** : l'accès direct à l'URL reste protégé par le backend.
- Les guards deviennent **déclaratifs** (un `RouteGuard` configuré par métadonnées, remplaçant `ProtectedRoute`/`SuperAdminRoute`/`UserRoute`).
- La navigation (sidebar) devient **dynamique** : sections/ordre/visibilité issus de la configuration, pas de `if (role === …)`.
- **Pas de migration Supabase maintenant** : seule l'architecture cible est documentée (aucune table de configuration supplémentaire ne sera créée à ce stade).

## Alternatives considérées

1. **Router par rôle dans l'URL** (`/super-admin/acces`) — rejeté : le rôle ne doit pas être dans l'URL ; le `route_key` reste la référence stable.
2. **Stocker les composants/noms de fichiers React dans Supabase** — rejeté : couplage frontend/backend, illisible, non sécurisé.
3. **Laisser la navigation hardcodée dans une sidebar par rôle** — rejeté : interdit (ADR-004), non extensible.
4. **Implémenter immédiatement la migration Supabase des routes** — rejeté : hors périmètre de cette étape (documentation seule).

## Conséquences

### Positives
- URLs signifiantes et stables indépendantes des rôles ; navigation pilotable ; garde d'accès centralisée ; i18n des titres via `titleKey` (voir [`i18n-architecture.md`](../architecture/i18n-architecture.md)).
- Évolutions de publication (activer/désactiver des pages) sans redéploiement, une fois le backend branché.

### Négatives / Risques
- Refactorisation des chemins (redirections/liens à mettre à jour) : à faire par phase avec tests manuels.
- Risque de confusion « visibilité ≠ sécurité » si mal documenté — rappelé dans le registry.

### À surveiller
- Conserver la compatibilité des anciennes URLs pendant la transition (redirections).
- Document de référence : [`routing-architecture.md`](../architecture/routing-architecture.md), [`roadmap/frontend-refactor.md`](../roadmap/frontend-refactor.md).

---

*Date : 2026-09-18*