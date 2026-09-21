---
id: ARCH-FRONTEND-TARGET-001
title: Architecture Frontend — Cible (refactorisation)
category: architecture
status: designed
version: 1.0.0
created_at: 2026-09-18
updated_at: 2026-09-18
source_of_truth: true
tags:
  - frontend
  - react
  - architecture-cible
  - refactoring
---

# Architecture Frontend — Cible

> Ce document décrit l'**architecture cible** validée pour le frontend.
> Il ne décrit pas l'état implémenté : pour celui-ci, voir [`frontend.md`](./frontend.md).
> Aucun code de production n'a été modifié : ce document est un contrat de travail pour la refactorisation.

## 1. Principes directeurs

| Principe | Application |
|----------|-------------|
| **KISS** | Pas de sur-engineering. Un module n'existe que s'il a une responsabilité claire, réutilisable ou susceptible d'évoluer indépendamment. |
| **SRP** | Une responsabilité par module. Pas de fichier « fourre-tout » (ex. `storage.js` ne doit pas contenir comptes + imports + normalisation). |
| **DRY** | Pas de copie de code entre pages (labels de rôles, modales CRUD, générateur PDF, sidebars, guards). |
| **Modularité / Réutilisabilité** | Composants indépendants du rôle quand le comportement n'est pas lié à un rôle. |
| **Sécurité** | Le backend (Supabase RBAC / RLS / RPC) reste la source de vérité. Le frontend ne simule jamais les autorisations. |
| **Performance / Maintenabilité / Testabilité** | Pas de fichiers gigantesques, pas de fragmentation artificielle, barrel exports explicites. |

**Règle de modération** : la modularité ne signifie PAS un fichier pour chaque petite fonction.
Créer un module uniquement lorsqu'il possède une responsabilité claire, réutilisable ou susceptible d'évoluer indépendamment.

## 2. Structure cible de premier niveau `src/`

Les domaines suivants sont **au même niveau** :

```
src/
├── app/              # Composition racine : providers, point d'entrée applicatif
├── routes/           # Registry des routes : route_key → path → composant (+ métadonnées navigation)
├── pages/            # Composants de page (par domaine)
├── components/       # Composants UI génériques (atoms/molecules/organisms) + composants métier
├── layouts/          # ApplicationLayout, AuthLayout, Sidebar et ses modules
├── hooks/            # Hooks par domaine (auth/, rbac/, navigation/, data/, ui/)
├── contexts/         # Contextes React (AuthContext, etc.)
├── services/         # Couche d'accès aux données / backend (auth, users, roles, rbac/, assessments, results)
├── lib/              # Primeurs sans dépendance métier (supabaseClient, theme, helpers)
├── data/             # Batteries et données statiques (dette → migration Supabase future)
├── config/           # Configuration applicative et d'environnement
├── constants/        # Clés techniques stables (route_key, slugs, namespaces i18n)
├── utils/            # Fonctions pures par domaine (score/, format/, validators/)
├── styles/           # Tokens + globals/utilities (Tailwind reste le système principal)
├── i18n/             # locales fr/ et en/, config, index
└── assets/           # Images, polices, fichiers statiques
```

Contraintes :
- **Interdiction** de regrouper hooks/services/routes/components dans un dossier `features/` global : les responsabilités doivent rester lisibles depuis la racine de `src/`.
- `layouts/` est un domaine de premier niveau (les `*Layout` ne restent pas dans `components/layout/`).

## 3. Domaines de premier niveau — responsabilités détaillées

### `src/app` (composition racine)
- `main.jsx`, `AppProviders.jsx` (assemblage des providers : Auth, Router, i18n, Theme).
- Aucune logique métier. C'est le seul endroit qui « colle » les providers entre eux.

### `src/routes` (registry dynamique)
- Un fichier de **registry** qui sépare : `route_key`, `path`, composant React, `titleKey`, métadonnées de navigation.
- Les guards deviennent **descriptifs** (déclarés par route), pas trois composants copiés.
- Voir [`routing-architecture.md`](./routing-architecture.md).

### `src/pages`
- Composants de page par **domaine fonctionnel** (auth/, account/, assessment/, results/, administration/).
- Le nom d'une page ne porte pas de préfixe lié à un rôle (plus de `SuperAdmin*`, `Admin*`).
  Exemples cibles : `AccessControlPage`, `AccountsPage`, `RolesPage`, `ResultsPage`, `TestPage`, `AccountPage`.

### `src/layouts`
- `ApplicationLayout` (shell générique : Sidebar ✓ + header ✓ + contenu) remplace `SuperAdminLayout`/`AppShell` (fusionnés).
- `AuthLayout` remplace `AuthShell`.
- `Sidebar` modulaire : voir [`component-architecture.md`](./component-architecture.md).

### `src/hooks`
- Organisation par domaine : `auth/`, `rbac/`, `navigation/`, `data/`, `ui/`.
- Les hooks **consomment les services** ; ils ne contiennent pas toute la logique backend.

### `src/contexts`
- Contextes d'état partagé (auth, i18n, navigation).
- Cible : **un contexte d'authentification unique** (fusion de `UserAuthContext` + `AdminAuthContext`).

### `src/services`
- Couche unique d'accès à Supabase par domaine : `auth/`, `users/`, `roles/`, `rbac/`, `assessments/`, `results/`.
- Pas de `rbacService.js` géant : découpe par domaine (voir ci-dessous).
- Voir [`state-and-data-flow.md`](./state-and-data-flow.md).

Exemple cible :

```
services/
├── auth/
│   ├── session.js
│   ├── password.js
│   └── index.js
├── users/
├── roles/
├── rbac/
│   ├── rolePermissions/
│   ├── roleDelegations/
│   ├── userDelegations/
│   ├── roleAssignability/
│   └── index.js
├── assessments/
├── results/
└── index.js
```

### `src/utils`
- Fonctions pures par domaine, découpées selon les responsabilités réelles (pas de faux CRUD).

```
utils/
├── score/
│   ├── calculateScore.js
│   ├── normalizeScore.js
│   ├── validateScore.js
│   └── index.js
├── format/
└── validators/
```

### `src/styles`
- Tokens de design + styles globaux. **Tailwind reste le système principal** ; pas de deuxième architecture CSS parallèle.
- `src/lib/theme.js` est conservé tel quel (modification volontaire de l'utilisateur) — il devient la source des tokens.
- Seule l'organisation des fichiers évolue : `tokens/`, `globals.css`, `utilities.css`, `index.css`.

### `src/config` / `src/constants`
- `config/` : variables d'environnement exposées (`VITE_*`), configuration applicative.
- `constants/` : clés techniques stables (route_keys, slugs de rôles pour l'UI uniquement, namespaces i18n).
  ⚠️ Les slugs de rôle dans `constants/` ne sont que des libellés de présentation ; **la décision d'accès appartient au backend**.

### `src/data`
- Batteries, dimensions, axes, métiers — **conservés tels quels pour l'instant** (dette documentée, voir `../../roadmap/frontend-refactor.md`).
- Migration future vers Supabase : les batteries deviendront des données backend ; `data/` sera alors vidé ou réduit.

## 4. Barrels exports (`index.js`)

- Utiliser des **barrel exports explicites** comme API publique des dossiers.
- Préférer les exports nommés ; éviter `export *` partout.
- Prévenir les dépendances circulaires (un module n'importe jamais son parent).

```
components/Avatar/
├── Avatar.jsx
├── AvatarSkeleton.jsx
└── index.js            # export { Avatar } from "./Avatar.jsx";
```

## 5. Langues (i18n)

Choix volontaire et acté pour cette refactorisation :
- **`fr`** et **`en`** uniquement.
- **`mg` (malgache) n'est PAS remplacé par `en`** ; le malgache pourra être ajouté ultérieurement.
- Détails : [`i18n-architecture.md`](./i18n-architecture.md).

## 6. Relation avec les documents existants

| Document existant | Rôle après refactorisation |
|-------------------|----------------------------|
| [`frontend.md`](./frontend.md) | Décrit l'état **implémenté** (avant refactorisation). Sera mis à jour/supprimé à la fin de la refactorisation. |
| [`reference/routes.md`](../reference/routes.md) | Référence **actuelle** des routes. La cible est décrite dans [`routing-architecture.md`](./routing-architecture.md). |
| [`decisions/ADR-001-frontend-untrusted.md`](../decisions/ADR-001-frontend-untrusted.md) | Toujours valable : le frontend reste non fiable, la sécurité est côté Supabase. |

## 7. Hors périmètre de la refactorisation frontend

- **Backend Supabase** : non modifié (pas de nouvelle table, pas de RPC/RLS modifiés).
- **Batteries** (`data/battery*.js`) : non refactorisées, migrées ultérieurement vers Supabase.
- **`src/lib/theme.js`** : jamais modifié.
- **UI / refonte visuelle** : hors périmètre.

---

*Dernière mise à jour : 2026-09-18*