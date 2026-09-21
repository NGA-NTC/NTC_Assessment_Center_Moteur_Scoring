-- ============================================================
-- P3.10 — Alignement des divergences D1–D7 (rapport P3.8)
-- Cible : RLS role-based / utilisations de has_role sur du trafic
-- permissionné → bascule vers l'autorité effective
-- (has_effective_capability avec scope).
-- Migration idempotente : purge/re-création des politiques ciblées.
-- ============================================================

begin;

-- ============================================================
-- D7 — rbac.role_assignability : retirer la capacité accordée à
-- 'admin' (incohérente : la table role_assignability est régie
-- par RLS super_admin-only et set_role_assignability exige DELEGATE
-- effectif — admin ne doit pas pouvoir modifier l'assignabilité).
-- ============================================================
update public.role_permissions
set can_use = false,
    can_manage = false,
    can_grant = false,
    can_delegate = false
where role_id = 'admin'
  and permission_id = 'rbac.role_assignability';

-- ============================================================
-- D1 — Catalogues (roles, permissions, pages, features,
-- page_features) : suppression des politiques role-based
-- *_manage_admin (audience réelle des écritures = super_admin,
-- vérifié par les routes UI). Les lectures select_all restent.
-- ============================================================
drop policy if exists "permissions_manage_admin" on public.permissions;
drop policy if exists "roles_manage_admin" on public.roles;
drop policy if exists "pages_manage_admin" on public.pages;
drop policy if exists "features_manage_admin" on public.features;
drop policy if exists "page_features_manage_admin" on public.page_features;

-- ============================================================
-- D3 — profiles : passage de la RLS role-based à l'autorité
-- effective.
--   * SELECT des profils d'autrui  → users.view   USE (global)
--   * UPDATE des profils d'autrui  → users.edit   USE (global)
--   * UPDATE de son propre profil  → identité + profile.edit USE
--   * INSERT hors trigger retiré (admin) ; INSERT par trigger
--     (handle_new_user) conservé ; garde super_admin structuelle.
-- ============================================================
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_select_super_admin" on public.profiles;

create policy "profiles_select_users_view"
on public.profiles
for select to authenticated
using (
  public.has_effective_capability(auth.uid(), 'USE', 'users.view', 'global', NULL)
);

drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_update_super_admin" on public.profiles;

create policy "profiles_update_users_edit"
on public.profiles
for update to authenticated
using (
  public.has_effective_capability(auth.uid(), 'USE', 'users.edit', 'global', NULL)
)
with check (
  public.has_effective_capability(auth.uid(), 'USE', 'users.edit', 'global', NULL)
);

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (
  (auth.uid() = id)
  and public.has_effective_capability(auth.uid(), 'USE', 'profile.edit', 'global', NULL)
);

drop policy if exists "profiles_insert_admin" on public.profiles;

-- ============================================================
-- D4 — user_roles : les mutations (INSERT/DELETE) via REST sont
-- supprimées : la source de vérité est la paire de RPC
-- assign_user_role / revoke_user_role (SECURITY DEFINER), qui
-- applique GRANT effectif users.change_role + role_assignability
-- + règles de promotion. Lecture : own conservé (identité),
-- global remplacé par users.view USE (effective).
-- ============================================================
drop policy if exists "user_roles_insert_admin" on public.user_roles;
drop policy if exists "user_roles_insert_super_admin" on public.user_roles;
drop policy if exists "user_roles_delete_admin" on public.user_roles;
drop policy if exists "user_roles_delete_super_admin" on public.user_roles;

drop policy if exists "user_roles_select_admin" on public.user_roles;
drop policy if exists "user_roles_select_super_admin" on public.user_roles;

create policy "user_roles_select_users_view"
on public.user_roles
for select to authenticated
using (
  public.has_effective_capability(auth.uid(), 'USE', 'users.view', 'global', NULL)
);

-- ============================================================
-- D5 — role_permissions : la lecture n'est plus réservée au
-- label 'super_admin' mais à une autorité effective sur
-- rbac.role_permissions (USE). Le trafic utilisateur n'est pas
-- élargi : seul super_admin porte cette permission aujourd'hui.
-- ============================================================
drop policy if exists "role_permissions_select_super_admin" on public.role_permissions;

create policy "role_permissions_select_effective"
on public.role_permissions
for select to authenticated
using (
  public.has_effective_capability(auth.uid(), 'USE', 'rbac.role_permissions', 'global', NULL)
);

-- ============================================================
-- D2 — RPC admin : remplacement des guards à base de rôles /
-- has_permission par l'autorité effective.
--   * admin_get_users            → users.view USE (global)
--   * admin_reset_user_password  → GRANT users.change_role
--     (scope 'user' sur la cible, aligné sur assign/revoke).
-- ============================================================
create or replace function public.admin_get_users()
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  caller_uid uuid := auth.uid();
  has_admin_perm boolean;
  result jsonb;
begin
  -- Autorité effective : users.view USE (admin + super_admin)
  select public.has_effective_capability(
           caller_uid, 'USE', 'users.view', 'global', NULL
         )
  into has_admin_perm;

  if not has_admin_perm then
    raise exception 'Accès refusé : permission users.view requise';
  end if;

  select jsonb_agg(row_to_json(t)) into result
  from (
    select
      u.id as user_id,
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
      array_agg(distinct r.id) filter (where r.id is not null) as role_ids,
      array_agg(distinct r.name) filter (where r.name is not null) as role_names
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.user_roles ur on ur.user_id = u.id
    left join public.roles r on r.id = ur.role_id
    group by u.id, p.id
    order by u.created_at desc
  ) t;

  return coalesce(result, '[]'::jsonb);
end $function$;

create or replace function public.admin_reset_user_password(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  caller_uid uuid := auth.uid();
  has_perm boolean;
  target_email text;
begin
  -- Autorité effective : GRANT users.change_role dans le scope
  -- de l'utilisateur ciblé (aligné sur le couple assign/revoke).
  select public.has_effective_capability(
           caller_uid, 'GRANT', 'users.change_role', 'user', target_user_id::text
         )
  into has_perm;

  if not has_perm then
    raise exception 'Permission users.change_role requise';
  end if;

  select email into target_email
  from auth.users
  where id = target_user_id;

  if target_email is null then
    raise exception 'Utilisateur cible introuvable';
  end if;

  raise notice 'Reset password authorized for user %', target_user_id;
end $function$;

-- ============================================================
-- D6 — Audit has_role/has_permission :
--   * has_permission() ne subsiste que dans du code legacy hors
--     trafic REST (promote_to_admin non granté, fonctions seed)
--     → non divergent, conservé.
--   * has_role() subsiste en RLS uniquement pour les gardes
--     structurelles de super_admin (insert/delete profiles,
--     catalogues manage_super_admin, tables rbac de délégation)
--     → label organisationnel, pas de permission à créer.
-- ============================================================

commit;