---
id: DECISIONS-README-001
title: Index des décisions d'architecture (ADR)
category: decisions
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - adr
  - decisions
  - architecture
---

# Architecture Decision Records (ADR)

## Liste des ADR

| ID | Titre | Statut | Date | Contexte |
|----|-------|--------|------|----------|
| [ADR-001](./ADR-001-frontend-untrusted.md) | Frontend non fiable — Sécurité côté Supabase | Accepted | 2026-09-11 | P1.2.1 Security Fix |
| [ADR-002](./ADR-002-role-access-audience-permission.md) | Séparation ROLE / AUTH STATE / ACCESS AUDIENCE / PERMISSION | Accepted | 2026-09-14 | P1.2.5 Pages & Features |
| [ADR-003](./ADR-003-delegation-model.md) | Modèle de délégation hiérarchique + individuelle | Accepted | 2026-09-15 | P1.3.2 + P1.3.3 |
| [ADR-frontend-modular-architecture](./ADR-frontend-modular-architecture.md) | Architecture frontend modulaire (domaines au même niveau) | Proposed | 2026-09-18 | Refactorisation frontend |
| [ADR-dynamic-routing](./ADR-dynamic-routing.md) | Routage dynamique (route_key/path/component/config/authorization) | Proposed | 2026-09-18 | Refactorisation frontend |

---

## Convention ADR

Chaque ADR suit le format :

```markdown
# ADR-XXX : Titre

## Statut
[Proposed | Accepted | Rejected | Deprecated | Superseded]

## Contexte
Quel problème nous amène à cette décision ?

## Décision
Quelle solution est choisie ?

## Alternatives considérées
Quelles autres options ont été évaluées ?

## Conséquences
- Positives
- Négatives / Risques
- À surveiller

## Contexte technique
Références vers code, migrations, docs associées.
```

## Index par thème

| Thème | ADR |
|-------|-----|
| Sécurité globale | ADR-001 |
| Modèle d'autorisation | ADR-002, ADR-003 |
| Frontend/Backend | ADR-001, ADR-004, ADR-005 |
| RBAC/Délégation | ADR-002, ADR-003 |
| Architecture frontend | ADR-004 |
| Routing | ADR-005 |

---

*Dernière mise à jour : 2026-09-15*