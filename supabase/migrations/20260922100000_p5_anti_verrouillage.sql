-- ============================================================================
-- P5 — Protection backend anti-verrouillage
-- ============================================================================
-- Objectif : garantir qu'il reste toujours au moins UN utilisateur actif
-- détenant GRANT effectif sur users.change_role (global) — l'« administrateur
-- de rôles » minimal nécessaire pour reprendre la main sur le système.
--
-- Principe CAPABILITÉ, pas de nom de rôle : candidate / admin / super_admin
-- ne sont jamais référencés ici. La protection vaut quel que soit le rôle qui
-- fournit réellement la capacité GRANT sur users.change_role.
--
-- Chemins protégés :
--   1. revoke_user_role : après révocation, aucune régression du compteur
--      des détenteurs de GRANT users.change_role (filet de sécurité ;
--      sous le modèle actuel où les grants de rôle sont globaux, l'acteur
--      reste de toute façon détenteur — la garde est une défense en profondeur).
--   2. roles DELETE : refus si le rôle est le SEUL à fournir GRANT sur
--      users.change_role (global) à un utilisateur actif.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper : utilisateurs actifs détenant GRANT effectif (global) sur
--    users.change_role (mêmes sources que has_effective_capability).
-- ----------------------------------------------------------------------------
create or replace function public.users_with_role_change_grant()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct ur.user_id
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where p.id = 'users.change_role'
    and rp.can_grant
    and ur.revoked_at is null
    and (ur.expires_at is null or ur.expires_at > now())
  union
  select distinct ur.user_id
  from public.user_roles ur
  join public.role_delegations rd on rd.target_role_id = ur.role_id
  where rd.permission_id = 'users.change_role'
    and rd.delegation_type = 'grant'
    and rd.scope_type = 'global'
    and rd.revoked_at is null
    and (rd.expires_at is null or rd.expires_at > now())
    and ur.revoked_at is null
    and (ur.expires_at is null or ur.expires_at > now())
  union
  select distinct ud.grantee_user_id
  from public.user_delegations ud
  where ud.permission_id = 'users.change_role'
    and ud.delegation_type = 'grant'
    and ud.scope_type = 'global'
    and ud.revoked_at is null
    and (ud.expires_at is null or ud.expires_at > now())
$$;

comment on function public.users_with_role_change_grant() is
'Utilisateurs actifs détenant GRANT effectif (scope global) sur users.change_role.
Fonction interne aux gardes anti-verrouillage ; non exposée au trafic REST.';

revoke all on function public.users_with_role_change_grant() from public, anon, authenticated;
grant execute on function public.users_with_role_change_grant() to service_role;

-- ----------------------------------------------------------------------------
-- 2. revoke_user_role — garde anti-verrouillage
-- ----------------------------------------------------------------------------
create or replace function public.revoke_user_role(
    p_target_user_id uuid,
    p_role_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_uid uuid := auth.uid();
    v_actor_has_authority boolean;
    v_actor_has_grant_after_revoke boolean;
    v_role_assigned boolean;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Valider les paramètres
    if p_target_user_id is null then
        raise exception 'VALIDATION_ERREUR: target_user_id requis';
    end if;
    if p_role_id is null or p_role_id = '' then
        raise exception 'VALIDATION_ERREUR: role_id requis';
    end if;

    -- 3. Vérifier que l'utilisateur cible existe
    if not exists (select 1 from auth.users where id = p_target_user_id) then
        raise exception 'UTILISATEUR_INEXISTANT: Utilisateur cible introuvable';
    end if;

    -- 4. Vérifier que le rôle cible existe
    if not exists (select 1 from public.roles where id = p_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle cible introuvable: %', p_role_id;
    end if;

    -- 5. Vérifier que l'utilisateur cible a ce rôle actuellement
    select exists (
        select 1 from public.user_roles
        where user_id = p_target_user_id
          and role_id = p_role_id
          and revoked_at is null
          and (expires_at is null or expires_at > now())
    ) into v_role_assigned;

    if not v_role_assigned then
        raise exception 'ROLE_NON_ATTRIBUE: L''utilisateur n''a pas ce rôle actif';
    end if;

    -- 5. Vérifier GRANT effectif sur users.change_role
    v_actor_has_authority := public.has_effective_capability(
        v_actor_uid,
        'GRANT',
        'users.change_role',
        'user',
        p_target_user_id::text
    );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: GRANT sur users.change_role requis pour l''utilisateur %', p_target_user_id;
    end if;

    -- 6. ANTI-AUTO-RÉVOCATION : Vérifier si l'acteur révoque son propre rôle
    -- Si oui, vérifier qu'il garde au moins un GRANT sur users.change_role après
    if v_actor_uid = p_target_user_id then
        -- Vérifier si l'acteur a d'autres rôles actifs avec GRANT sur users.change_role
        select exists (
            select 1
            from public.user_roles ur
            join public.role_permissions rp on rp.role_id = ur.role_id
            join public.permissions p on p.id = rp.permission_id
            where ur.user_id = v_actor_uid
              and ur.role_id != p_role_id  -- exclure le rôle à révoquer
              and ur.revoked_at is null
              and (ur.expires_at is null or ur.expires_at > now())
              and p.id = 'users.change_role'
              and rp.can_grant
        ) into v_actor_has_grant_after_revoke;

        if not v_actor_has_grant_after_revoke then
            raise exception 'AUTO_REVOCATION_INTERDITE: Impossible de révoquer son dernier rôle donnant GRANT sur users.change_role';
        end if;
    end if;

    -- 7. Révoquer le rôle
    update public.user_roles
    set revoked_at = now(),
        revoked_by = v_actor_uid
    where user_id = p_target_user_id
      and role_id = p_role_id
      and revoked_at is null;

    -- 8. ANTI-VERROUILLAGE : après révocation, il doit rester au moins un
    --    utilisateur actif détenant GRANT sur users.change_role (global).
    --    En cas d'échec l'exception annule la révocation (transaction implicite).
    if not exists (select 1 from public.users_with_role_change_grant()) then
        raise exception 'ANTI_VERROUILLAGE: Impossible de retirer le dernier rôle permettant l''administration des rôles (plus aucun utilisateur avec GRANT sur users.change_role)';
    end if;

    return;
end;
$$;

comment on function public.revoke_user_role(uuid, text) is
'Révoque un rôle d''un utilisateur.
Nécessite : GRANT sur users.change_role + scope utilisateur.
Anti-auto-révocation : interdit de révoquer son dernier rôle donnant GRANT sur users.change_role.
Anti-verrouillage : interdit de laisser le système sans GRANT sur users.change_role.';

grant execute on function public.revoke_user_role(uuid, text) to authenticated;
revoke execute on function public.revoke_user_role(uuid, text) from anon;

-- ----------------------------------------------------------------------------
-- 3. roles DELETE — refus en cas de « dernier fournisseur » de GRANT
-- ----------------------------------------------------------------------------
create or replace function public.roles_before_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_provides_critical_grant boolean;
begin
    -- Ce rôle fournit-il GRANT users.change_role (global) à un utilisateur actif ?
    select exists (
        select 1
        from public.role_permissions rp
        join public.permissions p on p.id = rp.permission_id
        where rp.role_id = old.id
          and p.id = 'users.change_role'
          and rp.can_grant
          and exists (
              select 1 from public.user_roles ur
              where ur.role_id = old.id
                and ur.revoked_at is null
                and (ur.expires_at is null or ur.expires_at > now())
          )
    ) into v_provides_critical_grant;

    if v_provides_critical_grant then
        -- Un AUTRE rôle fournit-il encore cette capacité à un utilisateur actif ?
        if not exists (
            select 1
            from public.role_permissions rp
            join public.permissions p on p.id = rp.permission_id
            where rp.role_id <> old.id
              and p.id = 'users.change_role'
              and rp.can_grant
              and exists (
                  select 1 from public.user_roles ur
                  where ur.role_id = rp.role_id
                    and ur.revoked_at is null
                    and (ur.expires_at is null or ur.expires_at > now())
              )
        ) then
            raise exception 'ROLE_INSUPPRIMABLE: Ce rôle est le dernier à fournir l''administration des rôles (GRANT sur users.change_role)';
        end if;
    end if;

    return old;
end;
$$;

drop trigger if exists roles_before_delete_guard on public.roles;
create trigger roles_before_delete_guard
before delete on public.roles
for each row execute function public.roles_before_delete_guard();

-- ============================================================================
-- FIN P5 anti-verrouillage
-- ============================================================================