---
id: VER-001
title: Versions du projet
category: versions
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - versions
  - releases
  - changelog
---

# Versions du projet

## Convention de versionning

**SemVer** : `MAJOR.MINOR.PATCH`

| Composant | Signification |
|-----------|---------------|
| `MAJOR` | Changement incompatible (breaking change) |
| `MINOR` | Nouvelle fonctionnalité compatible |
| `PATCH` | Correction de bug compatible |

> **Note** : Le projet n'a pas encore de version officielle publiée. Les versions ci-dessous sont des jalons internes basés sur les migrations.

---

## Jalons internes

| Version | Date | Migration | Description |
|---------|------|-----------|-------------|
| `0.1.0` | 2026-09-09 | `20260909213412` | Initialisation projet (schéma vide) |
| `0.2.0` | 2026-09-11 | `20260911` | RBAC base : profils, rôles, permissions, user_roles, trigger |
| `0.2.1` | 2026-09-11 | `20260911210000` | Security fix + rôle `super_admin` + RPC bootstrap/promote |
| `0.2.2` | 2026-09-12 | `20260912` | Nettoyage bootstrap super_admin |
| `0.3.0` | 2026-09-13 | `20260913` | RPC `admin_get_users` + `admin_reset_user_password` + Edge Function |
| `0.4.0` | 2026-09-14 | `20260914` | Tables `pages`, `features`, `page_features` + seed |
| `0.5.0` | 2026-09-15 | `20260915` | Extension RBAC : hiérarchie + 4 capacités + traçabilité |
| `0.6.0` | 2026-09-15 | `20260915165400` | Schéma délégation complet (3 tables) |

---

## Architecture par version

| Version | Architecture clé |
|---------|------------------|
| `0.1.0` | Projet initialisé (Vite + React + Supabase) |
| `0.2.x` | RBAC basique (roles, permissions, user_roles) + Auth |
| `0.3.x` | Admin RPC + Edge Function + Super Admin |
| `0.4.x` | Pages + Features administrables |
| `0.5.x` | RBAC étendu : hiérarchie + 4 capacités + traçabilité |
| `0.6.x` | Délégations complètes (rôle→rôle, user→user, assignabilité) |

---

## Prochaines versions planifiées (PLANNED)

| Version | Cible | Contenu prévu |
|---------|-------|---------------|
| `0.7.0` | P1.3.4 | RPC moteur autorité effective (`get_effective_authority`, mutations délégation) |
| `0.8.0` | P1.4 | Migration résultats localStorage → Supabase + audit_log |
| `0.9.0` | P1.5 | Création compte candidat via Edge Function + import JSON → Supabase |
| `1.0.0` | Release | Version stable, documentation complète, tests |

---

## Conventions de release

### Branches
- `main` → Production (tags `vX.Y.Z`)
- `develop` → Intégration continue
- `feature/*` / `fix/*` → PR vers `develop`

### Tagging
```bash
git tag -a v0.6.0 -m "Release 0.6.0: Délégations complètes"
git push origin v0.6.0
```

### Changelog format (CHANGELOG.md)

```markdown
## [0.6.0] - 2026-09-15

### Added
- Tables `role_delegations`, `user_delegations`, `role_assignability`
- RLS + indexes sur tables délégation
- Migration `20260915165400_p1_3_2_delegation_schema.sql`

### Changed
- Extension `roles` : `parent_id`, `hierarchy_level`, `is_assignable`
- Extension `role_permissions` : 4 capacités (USE/MANAGE/GRANT/DELEGATE)
- Extension `user_roles` : `expires_at`, `revoked_at`, `revoked_by`

### Fixed
- Migration données `role_permissions` : `can_use = true` pour existants
```

---

## Matrice de compatibilité

| Version Frontend | Version DB (migrations) | Compatible |
|-----------------|------------------------|------------|
| `0.6.x` | Migrations 1-8 | ✅ |
| `0.5.x` | Migrations 1-7 | ✅ |
| `0.4.x` | Migrations 1-6 | ✅ |
| `0.3.x` | Migrations 1-5 | ✅ |
| `0.2.x` | Migrations 1-4 | ⚠️ Partiel |
| `0.1.x` | Migration 1 | ⚠️ Partiel |

> **Règle** : Le frontend suppose les migrations appliquées. Build échoue si tables/colonnes manquantes.

---

## Versioning de la documentation

| Doc Version | Projet Version | Date | Auteur |
|-------------|----------------|------|--------|
| `1.0.0` | `0.6.0` | 2026-09-15 | OpenCode |

---

*Dernière mise à jour : 2026-09-15*