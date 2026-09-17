# Documentation NTC Assessment Center

Documentation technique du projet NTC Assessment Center — Moteur de scoring.

## Structure

```
documentation/
├── README.md                    # Ce fichier
├── architecture/                # Architecture du système
│   ├── overview.md              # Vue d'ensemble
│   ├── frontend.md              # Architecture frontend
│   ├── backend.md               # Architecture backend (Supabase)
│   ├── database.md              # Base de données
│   ├── authentication.md        # Authentification
│   ├── authorization.md         # Autorisation (RBAC + délégation)
│   ├── delegation.md            # Système de délégation
│   ├── access-audience.md       # Distinction ROLE / AUTH STATE / ACCESS AUDIENCE / PERMISSION
│   └── security.md              # Sécurité
├── guides/                      # Guides pratiques
│   ├── installation.md
│   ├── development.md
│   ├── deployment.md
│   └── conventions.md
├── reference/                   # Référence technique
│   ├── routes.md
│   ├── database.md
│   ├── rpc.md
│   ├── api.md
│   └── configuration.md
├── history/                     # Historiques
│   ├── migrations.md
│   ├── deployments.md
│   ├── code-changes.md
│   └── requests.md
├── decisions/                   # Architecture Decision Records (ADR)
│   ├── README.md
│   ├── ADR-001-frontend-untrusted.md
│   ├── ADR-002-role-access-audience-permission.md
│   └── ADR-003-delegation-model.md
├── versions/                    # Suivi des versions
│   └── versions.md
└── roadmap/                     # Feuille de route
    └── roadmap.md
```

## États des fonctionnalités

Dans cette documentation, chaque fonctionnalité est catégorisée selon son état réel :

| État | Signification |
|------|---------------|
| **IMPLEMENTED** | Réellement implémenté et vérifiable dans le code/base |
| **DESIGNED** | Conçu/documenté mais pas encore implémenté |
| **PLANNED** | Prévu pour une phase future |
| **UNKNOWN** | Information non vérifiable |

> **Important** : Ne jamais présenter une conception comme une fonctionnalité implémentée. Par exemple, l'architecture de délégation (P1.3.3) est **DESIGNED** — elle n'est pas encore implémentée.

## Point d'entrée

- **README racine** : [`../../README.md`](../../README.md)
- **Documentation** : Ce dossier

---

*Dernière mise à jour : 2026-09-15*