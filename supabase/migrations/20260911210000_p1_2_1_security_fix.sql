-- ============================================================================
-- P1.2.1 — Correction sécurité Supabase + Bootstrap Super Admin
-- ============================================================================
-- Migration idempotente pour être appliquée après 20260911_p1_2_profiles_rbac.sql

-- ============================================================================
-- 1. SUPPRESSION DE LA VUE PROBLÉMATIQUE user_with_roles
-- ============================================================================
drop view if exists public.user_with_roles;

-- ============================================================================
-- 2. CORRECTION DES FONCTIONS — SEARCH_PATH SÉCURISÉ
-- ============================================================================

-- 2.1 set_updated_at
drop trigger if exists profiles_updated_at on public.profiles;
drop trigger if exists roles_updated_at on public.roles;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

-- 2.2 has_role — search_path sécurisé
create or replace function public.has_role(user_id uuid, role_text text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = user_id and r.id = role_text
  );
$$;

-- 2.3 has_permission — search_path sécurisé
create or replace function public.has_permission(user_id uuid, perm_text text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = user_id and p.id = perm_text
  );
$$;

-- ============================================================================
-- 3. CORRECTION handle_new_user — RÉVOCATION EXECUTE PUBLIC
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role_id)
  values (new.id, 'candidate')
  on conflict (user_id, role_id) do nothing;

  return new;
end $$;

-- RÉVOQUER l'exécution publique — appelée uniquement par trigger sur auth.users
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ============================================================================
-- 4. AJOUT DU RÔLE SUPER_ADMIN
-- ============================================================================

insert into public.roles (id, name, description, is_system) values
  ('super_admin', 'Super Administrateur', 'Propriétaire du système - accès total y compris gestion des rôles admin', true)
on conflict (id) do nothing;

insert into public.permissions (id, name, description, category) values
  ('users.promote_admin', 'Promouvoir en admin', 'Attribuer le rôle admin à un utilisateur', 'users'),
  ('users.promote_super_admin', 'Promouvoir en super_admin', 'Attribuer le rôle super_admin (réservé au propriétaire)', 'users')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id) values
  ('super_admin', 'users.view'),
  ('super_admin', 'users.edit'),
  ('super_admin', 'users.manage'),
  ('super_admin', 'users.change_role'),
  ('super_admin', 'users.promote_admin'),
  ('super_admin', 'users.promote_super_admin'),
  ('super_admin', 'profile.view'),
  ('super_admin', 'profile.edit'),
  ('super_admin', 'assessment.take'),
  ('super_admin', 'assessment.evaluate'),
  ('super_admin', 'results.view'),
  ('super_admin', 'reports.view')
on conflict (role_id, permission_id) do nothing;

-- ============================================================================
-- 5. POLITIQUES RLS — SUPER_ADMIN
-- ============================================================================

-- PROFILES
create policy "profiles_select_super_admin"
on public.profiles for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

create policy "profiles_update_super_admin"
on public.profiles for update
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "profiles_insert_super_admin"
on public.profiles for insert
to authenticated
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "profiles_delete_super_admin"
on public.profiles for delete
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

-- ROLES
create policy "roles_manage_super_admin"
on public.roles for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "permissions_manage_super_admin"
on public.permissions for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "role_permissions_manage_super_admin"
on public.role_permissions for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

-- USER_ROLES
create policy "user_roles_select_super_admin"
on public.user_roles for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

create policy "user_roles_insert_super_admin"
on public.user_roles for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'super_admin')
  and public.has_permission(auth.uid(), 'users.change_role')
);

create policy "user_roles_delete_super_admin"
on public.user_roles for delete
to authenticated
using (
  public.has_role(auth.uid(), 'super_admin')
  and public.has_permission(auth.uid(), 'users.change_role')
);

-- ============================================================================
-- 6. PROCÉDURES SÉCURISÉES
-- ============================================================================

-- 6.1 Bootstrap super_admin (réservé au propriétaire, exécution manuelle via SQL Editor)
create or replace function public.bootstrap_super_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_super_admin_count int;
begin
  select count(*) into current_super_admin_count
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where r.id = 'super_admin';

  if current_super_admin_count > 0 then
    raise exception 'Un super_admin existe déjà. Utilisez la procédure standard de promotion.';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'Utilisateur cible introuvable.';
  end if;

  -- Supprimer le rôle candidate s'il existe
  delete from public.user_roles
  where user_id = target_user_id and role_id = 'candidate';

  -- Assigner le rôle super_admin
  insert into public.user_roles (user_id, role_id, assigned_by)
  values (target_user_id, 'super_admin', target_user_id)
  on conflict (user_id, role_id) do update set role_id = 'super_admin';

  insert into public.profiles (id, email)
  select id, email from auth.users where id = target_user_id
  on conflict (id) do nothing;

  raise notice 'Super admin bootstrap effectué pour utilisateur %', target_user_id;
end $$;

-- 6.2 Promotion admin (pour super_admin via interface)
create or replace function public.promote_to_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Seul un super_admin peut promouvoir un administrateur.';
  end if;

  if not public.has_permission(auth.uid(), 'users.promote_admin') then
    raise exception 'Permission users.promote_admin requise.';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'Utilisateur cible introuvable.';
  end if;

  insert into public.user_roles (user_id, role_id, assigned_by)
  values (target_user_id, 'admin', auth.uid())
  on conflict (user_id, role_id) do update set role_id = 'admin';

  raise notice 'Utilisateur % promu en administrateur', target_user_id;
end $$;

-- ============================================================================
-- 7. GRANT / REVOKE EXECUTE SÉCURISÉS
-- ============================================================================

-- Fonctions utiles pour l'app frontend
grant execute on function public.has_role(uuid, text) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

-- Révoquer l'exécution publique des fonctions sensibles
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.bootstrap_super_admin(uuid) from anon, authenticated, public;
revoke execute on function public.promote_to_admin(uuid) from anon, authenticated, public;

-- S'assurer que has_role/has_permission ne sont pas exécutables par anon
revoke execute on function public.has_role(uuid, text) from anon;
revoke execute on function public.has_permission(uuid, text) from anon;

-- ============================================================================
-- FIN
-- ============================================================================