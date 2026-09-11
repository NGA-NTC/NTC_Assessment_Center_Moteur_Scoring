-- ============================================================================
-- P1.2 — Profils utilisateurs, RBAC et fondations admin
-- ============================================================================

-- Extension pour UUID
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLE PROFILES
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  linkedin_url text,
  job_title text,
  location text,
  bio text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);
create index profiles_status_idx on public.profiles (status);

-- Trigger pour mettre à jour updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ============================================================================
-- RBAC — RÔLES ET PERMISSIONS
-- ============================================================================
create table public.roles (
  id text primary key,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id text primary key,
  name text not null,
  description text,
  category text not null default 'general',
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id text not null references public.roles (id) on delete cascade,
  assigned_by uuid references auth.users (id),
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_role_id_idx on public.user_roles (role_id);

-- Trigger updated_at pour roles
create trigger roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

-- ============================================================================
-- DONNÉES INITIALES RBAC
-- ============================================================================
insert into public.roles (id, name, description, is_system) values
  ('candidate', 'Candidat', 'Utilisateur passant les assessments', true),
  ('admin', 'Administrateur', 'Accès complet à l''administration', true)
on conflict (id) do nothing;

insert into public.permissions (id, name, description, category) values
  -- Users
  ('users.view', 'Voir les utilisateurs', 'Lister et consulter les profils utilisateurs', 'users'),
  ('users.edit', 'Modifier les utilisateurs', 'Modifier les informations des utilisateurs', 'users'),
  ('users.manage', 'Gérer les utilisateurs', 'Créer/supprimer des utilisateurs', 'users'),
  ('users.change_role', 'Changer les rôles', 'Attribuer/retirer des rôles aux utilisateurs', 'users'),
  -- Profile
  ('profile.view', 'Voir le profil', 'Consulter son propre profil', 'profile'),
  ('profile.edit', 'Modifier le profil', 'Modifier son propre profil', 'profile'),
  -- Assessment
  ('assessment.take', 'Passer les assessments', 'Accéder aux batteries d''évaluation', 'assessment'),
  ('assessment.evaluate', 'Évaluer les assessments', 'Noter et commenter les réponses', 'assessment'),
  -- Results
  ('results.view', 'Voir les résultats', 'Consulter les résultats des assessments', 'results'),
  ('reports.view', 'Voir les rapports', 'Générer et consulter les rapports', 'reports')
on conflict (id) do nothing;

-- Attribution permissions aux rôles
insert into public.role_permissions (role_id, permission_id) values
  -- Candidate permissions
  ('candidate', 'profile.view'),
  ('candidate', 'profile.edit'),
  ('candidate', 'assessment.take'),
  -- Admin permissions (all)
  ('admin', 'users.view'),
  ('admin', 'users.edit'),
  ('admin', 'users.manage'),
  ('admin', 'users.change_role'),
  ('admin', 'profile.view'),
  ('admin', 'profile.edit'),
  ('admin', 'assessment.take'),
  ('admin', 'assessment.evaluate'),
  ('admin', 'results.view'),
  ('admin', 'reports.view')
on conflict (role_id, permission_id) do nothing;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- Helper function pour vérifier si l'utilisateur a un rôle
create or replace function public.has_role(user_id uuid, role_text text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = user_id and r.id = role_text
  );
$$;

-- Helper function pour vérifier si l'utilisateur a une permission
create or replace function public.has_permission(user_id uuid, perm_text text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = user_id and p.id = perm_text
  );
$$;

-- ============================================================================
-- POLICES RLS — PROFILES
-- ============================================================================

-- Un utilisateur peut voir son propre profil
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

-- Un admin peut voir tous les profils
create policy "profiles_select_admin"
on public.profiles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Un utilisateur peut modifier son propre profil (sauf rôle et email)
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and id = auth.uid()
);

-- Un admin peut modifier tout profil
create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Un admin peut insérer des profils (pour bootstrap)
create policy "profiles_insert_admin"
on public.profiles for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- POLICES RLS — ROLES, PERMISSIONS, ROLE_PERMISSIONS
-- ============================================================================

-- Lecture publique pour roles/permissions (nécessaire pour UI)
create policy "roles_select_all"
on public.roles for select
to authenticated
using (true);

create policy "permissions_select_all"
on public.permissions for select
to authenticated
using (true);

create policy "role_permissions_select_all"
on public.role_permissions for select
to authenticated
using (true);

-- Seuls les admins peuvent gérer les rôles/permissions
create policy "roles_manage_admin"
on public.roles for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "permissions_manage_admin"
on public.permissions for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "role_permissions_manage_admin"
on public.role_permissions for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- POLICES RLS — USER_ROLES
-- ============================================================================

-- Un utilisateur peut voir ses propres rôles
create policy "user_roles_select_own"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id);

-- Un admin peut voir tous les user_roles
create policy "user_roles_select_admin"
on public.user_roles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Seuls les admins avec permission users.change_role peuvent assigner des rôles
create policy "user_roles_insert_admin"
on public.user_roles for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  and public.has_permission(auth.uid(), 'users.change_role')
);

create policy "user_roles_delete_admin"
on public.user_roles for delete
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  and public.has_permission(auth.uid(), 'users.change_role')
);

-- ============================================================================
-- TRIGGER AUTO-CRÉATION PROFILE + RÔLE CANDIDAT
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Créer le profil
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- Assigner le rôle candidate par défaut
  insert into public.user_roles (user_id, role_id)
  values (new.id, 'candidate')
  on conflict (user_id, role_id) do nothing;

  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
-- VUES UTILES
-- ============================================================================
create or replace view public.user_with_roles as
select
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at as auth_created_at,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  p.linkedin_url,
  p.job_title,
  p.location,
  p.bio,
  p.status,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at,
  array_agg(r.id) filter (where r.id is not null) as role_ids,
  array_agg(r.name) filter (where r.name is not null) as role_names
from auth.users u
left join public.profiles p on p.id = u.id
left join public.user_roles ur on ur.user_id = u.id
left join public.roles r on r.id = ur.role_id
group by u.id, p.id;

grant select on public.user_with_roles to authenticated;