-- ============================================================================
-- P1.2.4 — RPC Admin Users + Edge Function Reset Password
-- ============================================================================

-- ============================================================================
-- RPC : admin_get_users
-- Remplace la vue user_with_roles supprimée
-- Accessible uniquement aux admin/super_admin via RLS + permission check
-- ============================================================================

create or replace function public.admin_get_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_uid uuid := auth.uid();
  has_admin_perm boolean;
  result jsonb;
begin
  -- Vérifier que l'appelant est admin ou super_admin
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = caller_uid
    and r.id in ('admin', 'super_admin')
  ) into has_admin_perm;

  if not has_admin_perm then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  -- Récupérer les utilisateurs avec leurs rôles et profils
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
end $$;

grant execute on function public.admin_get_users() to authenticated;

-- ============================================================================
-- RPC : admin_reset_user_password
-- Remplace l'appel direct à supabase.auth.admin.generateLink()
-- Appelé depuis Edge Function côté serveur
-- ============================================================================

create or replace function public.admin_reset_user_password(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_uid uuid := auth.uid();
  has_perm boolean;
  target_email text;
begin
  -- Vérifier permission users.change_role (requise pour reset password admin)
  select public.has_permission(caller_uid, 'users.change_role') into has_perm;
  
  if not has_perm then
    raise exception 'Permission users.change_role requise';
  end if;

  -- Récupérer l'email cible
  select email into target_email
  from auth.users
  where id = target_user_id;

  if target_email is null then
    raise exception 'Utilisateur cible introuvable';
  end if;

  -- Note: L'envoi réel de l'email de reset est fait par l'Edge Function
  -- via supabase.auth.admin.generateLink() avec service_role
  -- Cette fonction ne fait que la vérification d'autorisation
  raise notice 'Reset password authorized for user %', target_user_id;
end $$;

grant execute on function public.admin_reset_user_password(uuid) to authenticated;

-- ============================================================================
-- RLS Policies pour permettre aux fonctions RPC d'accéder aux données
-- ============================================================================

-- Les policies existantes permettent déjà la lecture aux admins via has_role
-- Les fonctions SECURITY DEFINER s'exécutent avec les privilèges du propriétaire
-- (postgres/superuser), donc elles bypassent RLS pour la lecture interne

-- ============================================================================
-- FIN
-- ============================================================================