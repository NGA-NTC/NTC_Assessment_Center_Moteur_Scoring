-- ============================================================================
-- P1.2.2 — Nettoyage rôles Super Admin + Correction bootstrap
-- ============================================================================

-- 1. Mettre à jour bootstrap_super_admin pour SUPPRIMER candidate au lieu d'ajouter
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

-- 2. Nettoyer l'utilisateur super_admin existant : retirer le rôle candidate
delete from public.user_roles
where user_id = 'f34cd19c-1fc4-446a-9d22-cd30f57b27d4'
  and role_id = 'candidate';

-- Vérification
-- select * from public.user_roles where user_id = 'f34cd19c-1fc4-446a-9d22-cd30f57b27d4';