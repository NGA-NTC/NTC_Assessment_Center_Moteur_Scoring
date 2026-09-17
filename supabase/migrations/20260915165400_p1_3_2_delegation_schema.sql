-- ============================================================================
-- P1.3.2 — Structure des délégations RBAC (role_delegations, user_delegations, role_assignability)
-- ============================================================================

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLE role_delegations — Délégation par rôle (standard)
-- ============================================================================

create table if not exists public.role_delegations (
  id uuid primary key default gen_random_uuid(),
  delegator_role_id text not null,
  target_role_id text not null,
  permission_id text not null,
  delegation_type text not null,
  scope_type text not null default 'global',
  scope_value text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);

-- Foreign Keys
alter table public.role_delegations
  add constraint role_delegations_delegator_role_id_fkey
    foreign key (delegator_role_id) references public.roles(id) on delete restrict,
  add constraint role_delegations_target_role_id_fkey
    foreign key (target_role_id) references public.roles(id) on delete restrict,
  add constraint role_delegations_permission_id_fkey
    foreign key (permission_id) references public.permissions(id) on delete restrict,
  add constraint role_delegations_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete restrict,
  add constraint role_delegations_revoked_by_fkey
    foreign key (revoked_by) references auth.users(id) on delete set null;

-- CHECK Constraints
alter table public.role_delegations
  add constraint role_delegations_delegation_type_check
    check (delegation_type in ('use', 'manage', 'grant')),
  add constraint role_delegations_scope_type_check
    check (scope_type in ('global', 'role', 'user', 'self')),
  add constraint role_delegations_no_self_delegation_check
    check (delegator_role_id != target_role_id),
  add constraint role_delegations_expires_after_created_check
    check (expires_at is null or expires_at > created_at),
  add constraint role_delegations_revoked_after_created_check
    check (revoked_at is null or revoked_at >= created_at);

-- ============================================================================
-- 2. TABLE user_delegations — Délégation individuelle (exception)
-- ============================================================================

create table if not exists public.user_delegations (
  id uuid primary key default gen_random_uuid(),
  granter_user_id uuid not null,
  grantee_user_id uuid not null,
  permission_id text not null,
  delegation_type text not null,
  scope_type text not null default 'global',
  scope_value text,
  reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);

-- Foreign Keys
alter table public.user_delegations
  add constraint user_delegations_granter_user_id_fkey
    foreign key (granter_user_id) references auth.users(id) on delete restrict,
  add constraint user_delegations_grantee_user_id_fkey
    foreign key (grantee_user_id) references auth.users(id) on delete restrict,
  add constraint user_delegations_permission_id_fkey
    foreign key (permission_id) references public.permissions(id) on delete restrict,
  add constraint user_delegations_revoked_by_fkey
    foreign key (revoked_by) references auth.users(id) on delete set null;

-- CHECK Constraints
alter table public.user_delegations
  add constraint user_delegations_delegation_type_check
    check (delegation_type in ('use', 'manage', 'grant')),
  add constraint user_delegations_scope_type_check
    check (scope_type in ('global', 'role', 'user', 'self')),
  add constraint user_delegations_no_self_delegation_check
    check (granter_user_id != grantee_user_id),
  add constraint user_delegations_expires_after_created_check
    check (expires_at is null or expires_at > created_at),
  add constraint user_delegations_revoked_after_created_check
    check (revoked_at is null or revoked_at >= created_at);

-- IMPORTANT : Une délégation individuelle ne donne PAS automatiquement le droit de redéléguer.
-- Le bénéficiaire ne possède pas la capacité DELEGATE via cette table.

-- ============================================================================
-- 3. TABLE role_assignability — Quels rôles un rôle peut ATTRIBUER
-- ============================================================================

create table if not exists public.role_assignability (
  assigner_role_id text not null,
  assignable_role_id text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (assigner_role_id, assignable_role_id)
);

-- Foreign Keys
alter table public.role_assignability
  add constraint role_assignability_assigner_role_id_fkey
    foreign key (assigner_role_id) references public.roles(id) on delete restrict,
  add constraint role_assignability_assignable_role_id_fkey
    foreign key (assignable_role_id) references public.roles(id) on delete restrict,
  add constraint role_assignability_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete restrict;

-- CHECK Constraint : un rôle ne peut pas s'attribuer à lui-même via assignability
alter table public.role_assignability
  add constraint role_assignability_no_self_assign_check
    check (assigner_role_id != assignable_role_id);

-- ============================================================================
-- 4. INDEX pour performance
-- ============================================================================

-- role_delegations
create index if not exists role_delegations_delegator_role_id_idx on public.role_delegations (delegator_role_id);
create index if not exists role_delegations_target_role_id_idx on public.role_delegations (target_role_id);
create index if not exists role_delegations_permission_id_idx on public.role_delegations (permission_id);
create index if not exists role_delegations_expires_at_idx on public.role_delegations (expires_at);
create index if not exists role_delegations_revoked_at_idx on public.role_delegations (revoked_at);

-- user_delegations
create index if not exists user_delegations_granter_user_id_idx on public.user_delegations (granter_user_id);
create index if not exists user_delegations_grantee_user_id_idx on public.user_delegations (grantee_user_id);
create index if not exists user_delegations_permission_id_idx on public.user_delegations (permission_id);
create index if not exists user_delegations_expires_at_idx on public.user_delegations (expires_at);
create index if not exists user_delegations_revoked_at_idx on public.user_delegations (revoked_at);

-- role_assignability
create index if not exists role_assignability_assigner_role_id_idx on public.role_assignability (assigner_role_id);
create index if not exists role_assignability_assignable_role_id_idx on public.role_assignability (assignable_role_id);

-- ============================================================================
-- 5. RLS — Row Level Security
-- ============================================================================

-- Activer RLS
alter table public.role_delegations enable row level security;
alter table public.user_delegations enable row level security;
alter table public.role_assignability enable row level security;

-- ============================================================================
-- 5.1 RLS — role_delegations
-- ============================================================================

-- Lecture : Super Admin seulement (données de sécurité sensibles)
create policy "role_delegations_select_super_admin"
on public.role_delegations for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

-- Écriture : Super Admin seulement
create policy "role_delegations_manage_super_admin"
on public.role_delegations for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 5.2 RLS — user_delegations
-- ============================================================================

-- Lecture : Super Admin + parties concernées (granter/grantee)
create policy "user_delegations_select_super_admin"
on public.user_delegations for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

create policy "user_delegations_select_own"
on public.user_delegations for select
to authenticated
using (granter_user_id = auth.uid() or grantee_user_id = auth.uid());

-- Écriture : Super Admin seulement
create policy "user_delegations_manage_super_admin"
on public.user_delegations for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- 5.3 RLS — role_assignability
-- ============================================================================

-- Lecture : Super Admin (données de configuration d'autorisation)
create policy "role_assignability_select_super_admin"
on public.role_assignability for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

-- Écriture : Super Admin seulement
create policy "role_assignability_manage_super_admin"
on public.role_assignability for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================================
-- FIN
-- ============================================================================