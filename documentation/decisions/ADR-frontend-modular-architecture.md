---
id: ADR-004
title: Architecture frontend modulaire (domaines au même niveau)
status: proposed
date: 2026-09-18
category: decisions
tags:
  - frontend
  - architecture
  - refactoring
  - modularity
---

# ADR-004 : Architecture frontend modulaire

## Statut
**Proposed** — 2026-09-18 (en attente de validation)

## Contexte

`src/` évolue par empilement : `components/layout/` (3 sidebars + 2 shells jumeaux), `context/` (2 contextes d'auth qui double-souscrivent), `lib/` (fichiers multi-domaines : `storage.js` = comptes + imports + normalisation ; `export.js` = code mort dupliqué), `pages/` (noms par rôle, patterns CRUD/flash/avatar copiés entre pages). Cette organisation nuit à la lisibilité, à la maintenabilité et à la testabilité.

## Décision

Adopter une **structure de premier niveau par domaine** (responsabilité lisible depuis la racine de `src/`) :

```
src/app · src/routes · src/pages · src/components · src/layouts · src/hooks
src/contexts · src/services · src/lib · src/data · src/config · src/constants
src/utils · src/styles · src/i18n · src/assets
```

Avec les règles suivantes :
- **SRP / DRY** : un module = une responsabilité claire. Pas de fichiers fourre-tout, pas de copie entre pages.
- **KISS** : pas de sur-engineering ni de fragmentation artificielle.
- **Barrel exports explicites** (`index.js`), pas de `export *` systématique, pas de dépendances circulaires.
- **Composants indépendants du rôle** sauf comportement intrinsèquement lié.
- **Sidebar / Layouts dynamiques** : `ApplicationLayout` + `Sidebar` modulaire. Interdits : `SuperAdminSidebar`, `AdminSidebar`, `CandidateSidebar`, `SuperAdminLayout`, `AdminLayout`, `CandidateLayout` et les `if (role === "super_admin")` pour simuler des autorisations.
- **Frontend non fiable** : le backend reste la source de vérité (ADR-001).

## Alternatives considérées

1. **Conserver la structure actuelle** — rejeté : duplications avérées, noms par rôle, maintenance coûteuse.
2. **Refactorer par `features/`** — rejeté : noie les responsabilités transverses (hooks/services/routes) dans des sous-dossiers.
3. **Atomic Design strict** — rejeté : sur-engineering ; on l'utilise seulement pour les composants UI génériques.
4. **Modèle "un fichier par fonction"** — rejeté : fragmentation artificielle, contre KISS.

## Conséquences

### Positives
- Responsabilités immédiatement lisibles ; duplication éliminée ; testabilité accrue (utils purs, services/hooks découplés).
- Migration incrémentale possible par domaine.

### Négatives / Risques
- Refactorisation de grande ampleur : à mener par phases validées, sans casser le fonctionnel.
- Coût transitoire sur les imports (beaucoup de chemins changent).

### À surveiller
- Limiter chaque phase à un domaine ; vérifier `pnpm run lint` + `pnpm run build` après chaque phase.
- Documents de référence : [`frontend-architecture.md`](../architecture/frontend-architecture.md), [`component-architecture.md`](../architecture/component-architecture.md), [`state-and-data-flow.md`](../architecture/state-and-data-flow.md), [`roadmap/frontend-refactor.md`](../roadmap/frontend-refactor.md).

---

*Date : 2026-09-18*