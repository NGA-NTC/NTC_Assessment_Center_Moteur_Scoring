-- ============================================================================
-- P1.3.1 — Extension schéma RBAC de base (roles, role_permissions, user_roles)
-- ============================================================================

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLE roles — Ajout colonnes hiérarchie
-- ============================================================================

alter table public.roles
  add column if not exists parent_id text references public.roles(id) on delete set null,
  add column if not exists hierarchy_level int not null default 0,
  add column if not exists is_assignable boolean not null default true;

-- Index pour requêtes hiérarchiques
create index if not exists roles_parent_id_idx on public.roles (parent_id);

-- Commentaire : parent_id est une information de hiérarchie uniquement.
-- Il ne constitue PAS une preuve d'autorité.
-- L'autorité réelle provient des permissions/capacités et délégations explicites.

-- ============================================================================
-- 2. TABLE role_permissions — Ajout capacités indépendantes
-- ============================================================================

alter table public.role_permissions
  add column if not exists can_use boolean not null default false,
  add column if not exists can_manage boolean not null default false,
  add column if not exists can_grant boolean not null default false,
  add column if not exists can_delegate boolean not null default false;

-- Migration des données existantes : les permissions actuelles = USE uniquement
-- (comportement par défaut historique)
update public.role_permissions
set can_use = true
where can_use = false and can_manage = false and can_grant = false and can_delegate = false;

-- Commentaire : Les 4 capacités (USE, MANAGE, GRANT, DELEGATE) sont INDÉPENDANTES.
-- Aucune inclusion automatique : DELEGATE ⇏ GRANT ⇏ MANAGE ⇏ USE.
-- Chaque drapeau doit être géré explicitement par SUPER_ADMIN.

-- ============================================================================
-- 3. TABLE user_roles — Ajout traçabilité
-- ============================================================================

alter table public.user_roles
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null;

-- ============================================================================
-- 4. INDEX additionnels
-- ============================================================================

create index if not exists user_roles_expires_at_idx on public.user_roles (expires_at);
create index if not exists user_roles_revoked_at_idx on public.user_roles (revoked_at);

-- ============================================================================
-- FIN
-- ============================================================================