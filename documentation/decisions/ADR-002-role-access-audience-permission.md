---
id: ADR-002
title: Séparation ROLE / AUTH STATE / ACCESS AUDIENCE / PERMISSION
status: accepted
date: 2026-09-14
category: decisions
tags:
  - authorization
  - roles
  - permissions
  - access-control
---

# ADR-002 : Séparation ROLE / AUTH STATE / ACCESS AUDIENCE / PERMISSION

## Statut
**Accepted** — 2026-09-14

## Contexte

L'application NTC mélangeait initialement les concepts de rôle, état d'authentification, audience d'accès et permission, créant des confusions :
- `public` parfois traité comme un rôle
- `authenticated` confondu avec "a une permission"
- Page vs Feature : protection au niveau page seulement
- Pas de distinction entre "utiliser" et "gérer" une fonctionnalité

## Décision

Séparer **formellement 4 concepts orthogonaux** :

| Concept | Question | Domaine | Exemples | Stockage |
|---------|----------|---------|----------|----------|
| **ROLE** | "Qu'est-ce que l'utilisateur EST ?" | Métier/Org | `super_admin`, `admin`, `encadreur`, `candidat` | `roles` + `user_roles` |
| **AUTH STATE** | "Comment l'utilisateur SE CONNECTE ?" | Technique | `anonymous`, `authenticated` | `auth.users` (session) |
| **ACCESS AUDIENCE** | "QUI peut accéder à cette RESSOURCE ?" | Politique déclarative | `public`, `authenticated`, `role_based` | `pages.access_audience`, `features.access_audience` |
| **PERMISSION / CAPABILITY** | "QUELLE action est autorisée ?" | Granulaire | `USE`, `MANAGE`, `GRANT`, `DELEGATE` | `role_permissions.can_*` + délégations |

> **Règle d'or** : `public` ≠ rôle. Un visiteur anonyme n'existe **jamais** dans `user_roles`.

## Décision détaillée

### 1. ROLE ≠ ACCESS AUDIENCE
- Un rôle = identité organisationnelle (métier)
- Une audience = politique d'accès sur une ressource (page/feature)
- Une page `public` n'a pas de rôle associé

### 2. AUTH STATE ≠ PERMISSION
- `authenticated` = session valide (JWT)
- Permission = capacité explicite (`USE`, `MANAGE`, `GRANT`, `DELEGATE`)
- Être connecté ≠ avoir une permission

### 3. PAGE ≠ FEATURE (indépendance)
- Page `public` + Feature `role_based` → Page accessible, feature masquée
- Résolution : la plus restrictive gagne au niveau feature

### 4. 4 Capacités INDÉPENDANTES
| Code | Nom | Description |
|------|-----|-------------|
| `USE` | Utiliser | Lire, exécuter, consulter |
| `MANAGE` | Gérer | CRUD complet |
| `GRANT` | Accorder | Attribuer à d'autres |
| `DELEGATE` | Déléguer | Permettre à un rôle de GRANT |

> **Règle** : Aucune inclusion automatique. `MANAGE` ⇏ `GRANT` ⇏ `DELEGATE`.

## Alternatives considérées

| Alternative | Évaluation |
|-------------|------------|
| `public` comme rôle | **Rejeté** — pollue `user_roles`, ne marche pas pour `anonymous` |
| `authenticated` = permission de base | **Rejeté** — trop permissif, pas granulaire |
| Page = Feature (protection unique) | **Rejeté** — empêche page publique + feature protégée |
| Hiérarchie capacités (MANAGE ⊃ USE) | **Rejeté** — trop rigide, cas d'usage besoin USE seul |

## Conséquences

### Positives
- ✅ Modèle clair, extensible (nouveaux rôles/audiences sans casser existant)
- ✅ Sécurité granulaire (scope + capability)
- ✅ UX flexible (page publique + features protégées)
- ✅ Audit précis (quelle capacité, quel scope, quelle source)

### Négatives
- ⚠️ Complexité accrue (4 concepts vs 1-2 avant)
- ⚠️ Frontend doit gérer 4 dimensions (role, auth, audience, capability)
- ⚠️ Moteur autorité effective plus complexe (RPC futur)

## Contexte technique

### Schéma DB (P1.2.5 + P1.3.1)
```sql
-- pages
access_audience text CHECK IN ('public','authenticated','role_based')
access_permission text FK permissions(id)

-- features
access_audience text CHECK IN ('public','authenticated','role_based')
access_permission text FK permissions(id)
access_scope_type text CHECK IN ('global','role','user','self')
access_scope_value text

-- role_permissions (P1.3.1)
can_use, can_manage, can_grant, can_delegate boolean DEFAULT false
```

### Frontend (UserAuthContext)
```js
hasRole('admin')           // ROLE
hasPermission('users.edit') // PERMISSION (USE par défaut)
isAdmin                    // ROLE dérivé
```

### RLS Pages/Features
```sql
CASE access_audience
  WHEN 'public' THEN true
  WHEN 'authenticated' THEN auth.uid() IS NOT NULL
  WHEN 'role_based' THEN has_permission(auth.uid(), access_permission)
END
```

## Conséquences

### Positives
- ✅ Modèle clair, extensible (nouveaux rôles/audiences sans casser)
- ✅ Sécurité granulaire (scope + capability)
- ✅ UX flexible (page publique + features protégées)
- ✅ Audit précis (quelle capacité, quel scope, quelle source)

### Négatives
- ⚠️ Complexité accrue (4 concepts vs 1-2 avant)
- ⚠️ Frontend gère 4 dimensions (role, auth, audience, capability)
- ⚠️ Moteur autorité effective plus complexe (RPC futur)

## Contexte technique

### Migrations associées
- `20260914_p1_2_5_pages_features.sql` — Tables pages/features + access_audience
- `20260915_p1_3_1_rbac_base_schema.sql` — 4 capacités sur role_permissions

### Fichiers clés
- `src/pages/SuperAdminPages.jsx`, `SuperAdminFeatures.jsx`
- `src/components/layout/SuperAdminSidebar.jsx`
- `src/context/UserAuthContext.jsx` (hasRole, hasPermission)

---

*Décision validée le 2026-09-14 — Appliquée via migrations P1.2.5 + P1.3.1*