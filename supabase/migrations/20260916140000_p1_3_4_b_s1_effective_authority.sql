-- ============================================================================
-- P1.3.4-B-S1 — Moteur d'autorité effective READ-ONLY
-- ============================================================================

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. scope_includes — Vérification d'inclusion de scope
-- ============================================================================

create or replace function public.scope_includes(
    p_scope_type_a text,
    p_scope_value_a text,
    p_scope_type_b text,
    p_scope_value_b text
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    -- Global inclut tout
    if p_scope_type_a = 'global' then
        return true;
    end if;

    -- Même type, même valeur (gestion correcte des NULL)
    if p_scope_type_a = p_scope_type_b 
       and (p_scope_value_a = p_scope_value_b 
            or (p_scope_value_a is null and p_scope_value_b is null)) then
        return true;
    end if;

    -- Role inclut User si même rôle
    if p_scope_type_a = 'role' and p_scope_type_b = 'user' then
        -- Vérifier que l'utilisateur (scope_value_b) a le rôle (scope_value_a)
        if p_scope_value_b is not null and p_scope_value_a is not null then
            return exists (
                select 1 from public.user_roles ur
                where ur.user_id = p_scope_value_b::uuid
                  and ur.role_id = p_scope_value_a
                  and ur.revoked_at is null
                  and (ur.expires_at is null or ur.expires_at > now())
            );
        end if;
        return false;
    end if;

    -- Self n'inclut rien d'autre
    if p_scope_type_a = 'self' then
        return false;
    end if;

    return false;
end;
$$;

comment on function public.scope_includes(
    p_scope_type_a text,
    p_scope_value_a text,
    p_scope_type_b text,
    p_scope_value_b text
) is 'Vérifie si le scope A inclut le scope B. Hiérarchie: global ⊃ role ⊃ user ⊃ self.';

grant execute on function public.scope_includes(text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 2. has_effective_capability — Vérification capacité effective
-- ============================================================================

create or replace function public.has_effective_capability(
    p_user_id uuid,
    p_capability text,
    p_permission_id text,
    p_scope_type text default 'global',
    p_scope_value text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result boolean := false;
begin
    -- Validation de la capacité
    if p_capability not in ('USE', 'MANAGE', 'GRANT', 'DELEGATE') then
        raise exception 'Capacité invalide: %', p_capability;
    end if;

    -- 1. Vérifier les permissions directes via les rôles de l'utilisateur
    -- (rôles actifs, non expirés, non révoqués)
    select exists (
        select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = p_user_id
          and p.id = p_permission_id
          and ur.revoked_at is null
          and (ur.expires_at is null or ur.expires_at > now())
          and case 
                when p_capability = 'USE' then rp.can_use
                when p_capability = 'MANAGE' then rp.can_manage
                when p_capability = 'GRANT' then rp.can_grant
                when p_capability = 'DELEGATE' then rp.can_delegate
              end
    ) into v_result;

    if v_result then
        return true;
    end if;

    -- 2. Vérifier les délégations de rôle (role_delegations)
    -- L'utilisateur hérite des délégations accordées à ses rôles
    -- Note: DELEGATE n'est pas un type de délégation (seulement use/manage/grant)
    -- Pour DELEGATE, on vérifie seulement role_permissions.can_delegate directement (déjà fait ci-dessus)
    if p_capability <> 'DELEGATE' then
        select exists (
            select 1
            from public.user_roles ur
            join public.role_delegations rd on rd.target_role_id = ur.role_id
            join public.permissions p on p.id = rd.permission_id
            where ur.user_id = p_user_id
              and ur.revoked_at is null
              and (ur.expires_at is null or ur.expires_at > now())
              and rd.permission_id = p_permission_id
              and rd.revoked_at is null
              and (rd.expires_at is null or rd.expires_at > now())
              and rd.delegation_type = case p_capability
                when 'USE' then 'use'
                when 'MANAGE' then 'manage'
                when 'GRANT' then 'grant'
              end
              and public.scope_includes(rd.scope_type, rd.scope_value, p_scope_type, p_scope_value)
        ) into v_result;

        if v_result then
            return true;
        end if;
    end if;

    -- 3. Vérifier les délégations utilisateur (user_delegations) - priorité haute
    -- L'utilisateur peut être grantee OU granter (pour vérifier s'il a reçu une délégation)
    -- Note: DELEGATE n'est pas un type de délégation pour user_delegations non plus
    if p_capability <> 'DELEGATE' then
        select exists (
            select 1
            from public.user_delegations ud
            join public.permissions p on p.id = ud.permission_id
            where ud.grantee_user_id = p_user_id
              and ud.permission_id = p_permission_id
              and ud.revoked_at is null
              and (ud.expires_at is null or ud.expires_at > now())
              and ud.delegation_type = case p_capability
                when 'USE' then 'use'
                when 'MANAGE' then 'manage'
                when 'GRANT' then 'grant'
              end
              and public.scope_includes(ud.scope_type, ud.scope_value, p_scope_type, p_scope_value)
        ) into v_result;
    end if;

    return v_result;
end;
$$;

comment on function public.has_effective_capability(
    p_user_id uuid,
    p_capability text,
    p_permission_id text,
    p_scope_type text,
    p_scope_value text
) is 'Vérifie si un utilisateur a une capacité effective (USE/MANAGE/GRANT/DELEGATE) sur une permission dans un scope donné, en tenant compte des rôles, délégations de rôle, délégations utilisateur, scopes, expiration et révocation. DELEGATE est une capacité méta qui ne s''obtient que via role_permissions.can_delegate, pas par délégation.';

grant execute on function public.has_effective_capability(uuid, text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 3. has_effective_permission — Wrapper de compatibilité
-- ============================================================================

create or replace function public.has_effective_permission(
    p_user_id uuid,
    p_permission_id text,
    p_capability text default 'USE',
    p_scope_type text default 'global',
    p_scope_value text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    return public.has_effective_capability(p_user_id, p_capability, p_permission_id, p_scope_type, p_scope_value);
end;
$$;

comment on function public.has_effective_permission(
    p_user_id uuid,
    p_permission_id text,
    p_capability text,
    p_scope_type text,
    p_scope_value text
) is 'Vérifie si un utilisateur a une permission effective avec une capacité donnée dans un scope. Wrapper sur has_effective_capability.';

grant execute on function public.has_effective_permission(uuid, text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 4. get_effective_authority — Autorité effective complète
-- ============================================================================

create or replace function public.get_effective_authority(
    p_user_id uuid,
    p_permission_id text default null,
    p_scope_type text default null,
    p_scope_value text default null
) returns table (
    permission_id text,
    permission_name text,
    capability text,
    source text,
    source_role_id text,
    source_user_id uuid,
    chain_depth integer,
    scope_type text,
    scope_value text,
    expires_at timestamptz,
    revoked_at timestamptz,
    grantor_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_super_admin boolean;
begin
    -- Vérification de sécurité : un utilisateur ne peut consulter que sa propre autorité
    -- sauf s'il est super_admin
    if p_user_id <> auth.uid() then
        select public.has_role(auth.uid(), 'super_admin') into v_is_super_admin;
        if not v_is_super_admin then
            raise exception 'Accès refusé : vous ne pouvez consulter que votre propre autorité';
        end if;
    end if;

    -- Vérifier que l'utilisateur cible existe
    if not exists (select 1 from auth.users where id = p_user_id) then
        raise exception 'Utilisateur cible introuvable';
    end if;

    return query
    with recursive
    -- 1. Rôles actifs de l'utilisateur (non expirés, non révoqués)
    active_roles as (
        select ur.role_id, r.name as role_name
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = p_user_id
          and ur.revoked_at is null
          and (ur.expires_at is null or ur.expires_at > now())
    ),
    -- 2. Permissions directes via les rôles (source='role')
    direct_perms as (
        select 
            rp.permission_id,
            p.name as permission_name,
            case when rp.can_use then 'USE' end as capability,
            'role' as source,
            ar.role_id as source_role_id,
            null::uuid as source_user_id,
            0 as chain_depth,
            'global' as scope_type,
            null::text as scope_value,
            null::timestamptz as expires_at,
            null::timestamptz as revoked_at,
            null::uuid as grantor_user_id
        from active_roles ar
        join public.role_permissions rp on rp.role_id = ar.role_id
        join public.permissions p on p.id = rp.permission_id
        where rp.can_use
        union all
        select 
            rp.permission_id,
            p.name,
            'MANAGE',
            'role',
            ar.role_id,
            null::uuid,
            0,
            'global',
            null::text,
            null::timestamptz,
            null::timestamptz,
            null::uuid
        from active_roles ar
        join public.role_permissions rp on rp.role_id = ar.role_id
        join public.permissions p on p.id = rp.permission_id
        where rp.can_manage
        union all
        select 
            rp.permission_id,
            p.name,
            'GRANT',
            'role',
            ar.role_id,
            null::uuid,
            0,
            'global',
            null::text,
            null::timestamptz,
            null::timestamptz,
            null::uuid
        from active_roles ar
        join public.role_permissions rp on rp.role_id = ar.role_id
        join public.permissions p on p.id = rp.permission_id
        where rp.can_grant
        union all
        select 
            rp.permission_id,
            p.name,
            'DELEGATE',
            'role',
            ar.role_id,
            null::uuid,
            0,
            'global',
            null::text,
            null::timestamptz,
            null::timestamptz,
            null::uuid
        from active_roles ar
        join public.role_permissions rp on rp.role_id = ar.role_id
        join public.permissions p on p.id = rp.permission_id
        where rp.can_delegate
    ),
    -- 2. Délégations de rôle (role_delegations) - récursif pour chaînes
    role_delegations_chain as (
        -- Base: délégations directes depuis les rôles de l'utilisateur
        select 
            rd.id as delegation_id,
            rd.permission_id,
            p.name as permission_name,
            rd.delegation_type,
            rd.scope_type,
            rd.scope_value,
            rd.created_by as grantor_user_id,
            rd.created_at,
            rd.expires_at,
            rd.revoked_at,
            rd.delegator_role_id as source_role_id,
            null::uuid as source_user_id,
            1 as chain_depth,
            array[rd.delegator_role_id] as path
        from public.role_delegations rd
        join public.permissions p on p.id = rd.permission_id
        join active_roles ar on ar.role_id = rd.delegator_role_id
        where rd.revoked_at is null
          and (rd.expires_at is null or rd.expires_at > now())
          and rd.delegation_type in ('use', 'manage', 'grant')

        union all

        -- Récursif: délégations déléguées (chaîne)
        select 
            rd.id,
            rd.permission_id,
            p.name,
            rd.delegation_type,
            rd.scope_type,
            rd.scope_value,
            rd.created_by,
            rd.created_at,
            rd.expires_at,
            rd.revoked_at,
            rd.delegator_role_id,
            null::uuid,
            dc.chain_depth + 1,
            dc.path || rd.delegator_role_id
        from public.role_delegations rd
        join public.permissions p on p.id = rd.permission_id
        join role_delegations_chain dc on dc.source_role_id = rd.target_role_id
        where rd.revoked_at is null
          and (rd.expires_at is null or rd.expires_at > now())
          and rd.delegation_type in ('use', 'manage', 'grant')
          and not rd.delegator_role_id = any(dc.path)  -- Anti-cycle
          and dc.chain_depth < 5  -- Limite de profondeur
    ),
    -- 3. Délégations utilisateur (user_delegations)
    user_delegations_valid as (
        select 
            ud.id as delegation_id,
            ud.permission_id,
            p.name as permission_name,
            ud.delegation_type,
            ud.scope_type,
            ud.scope_value,
            ud.granter_user_id as grantor_user_id,
            ud.created_at,
            ud.expires_at,
            ud.revoked_at,
            null::text as source_role_id,
            ud.granter_user_id as source_user_id,
            0 as chain_depth,
            array[]::text[] as path
        from public.user_delegations ud
        join public.permissions p on p.id = ud.permission_id
        where ud.grantee_user_id = p_user_id
          and ud.revoked_at is null
          and (ud.expires_at is null or ud.expires_at > now())
          and ud.delegation_type in ('use', 'manage', 'grant')
    ),
    -- 4. Fusion de toutes les sources avec priorité
    all_authorities as (
        select * from direct_perms
        union all
        select 
            dc.permission_id,
            dc.permission_name,
            case dc.delegation_type when 'use' then 'USE' when 'manage' then 'MANAGE' when 'grant' then 'GRANT' end as capability,
            'role_delegation' as source,
            dc.source_role_id,
            dc.source_user_id,
            dc.chain_depth,
            dc.scope_type,
            dc.scope_value,
            dc.expires_at,
            dc.revoked_at,
            dc.grantor_user_id
        from role_delegations_chain dc
        where dc.revoked_at is null
          and (dc.expires_at is null or dc.expires_at > now())
        union all
        select 
            ud.permission_id,
            ud.permission_name,
            case ud.delegation_type when 'use' then 'USE' when 'manage' then 'MANAGE' when 'grant' then 'GRANT' end as capability,
            'user_delegation' as source,
            ud.source_role_id,
            ud.source_user_id,
            ud.chain_depth,
            ud.scope_type,
            ud.scope_value,
            ud.expires_at,
            ud.revoked_at,
            ud.grantor_user_id
        from user_delegations_valid ud
    ),
    -- 5. Filtrer selon les paramètres d'entrée et fusionner
    filtered as (
        select 
            fa.permission_id,
            fa.permission_name,
            fa.capability,
            fa.source,
            fa.source_role_id,
            fa.source_user_id,
            fa.chain_depth,
            fa.scope_type,
            fa.scope_value,
            fa.expires_at,
            fa.revoked_at,
            fa.grantor_user_id
        from all_authorities fa
        where (p_permission_id is null or fa.permission_id = p_permission_id)
          and (p_scope_type is null or 
               (fa.scope_type = p_scope_type and (p_scope_value is null or fa.scope_value = p_scope_value)))
          and (p_scope_type is not null or fa.scope_type = 'global' or fa.scope_type is not null)
    )
    select 
        fa.permission_id,
        fa.permission_name,
        fa.capability,
        fa.source,
        fa.source_role_id,
        fa.source_user_id,
        fa.chain_depth,
        fa.scope_type,
        fa.scope_value,
        fa.expires_at,
        fa.revoked_at,
        fa.grantor_user_id
    from filtered fa
    order by 
        case fa.source when 'user_delegation' then 1 when 'role_delegation' then 2 else 3 end,
        fa.chain_depth,
        fa.permission_id;
end;
$$;

comment on function public.get_effective_authority(
    p_user_id uuid,
    p_permission_id text,
    p_scope_type text,
    p_scope_value text
) is 'Retourne l''autorité effective complète d''un utilisateur (permissions + capacités + sources + scopes + chaîne de délégation). Un utilisateur ne peut consulter que sa propre autorité, sauf super_admin.';

grant execute on function public.get_effective_authority(uuid, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 5. has_effective_permission — Wrapper de compatibilité
-- ============================================================================

create or replace function public.has_effective_permission(
    p_user_id uuid,
    p_permission_id text,
    p_capability text default 'USE',
    p_scope_type text default 'global',
    p_scope_value text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    return public.has_effective_capability(p_user_id, p_capability, p_permission_id, p_scope_type, p_scope_value);
end;
$$;

comment on function public.has_effective_permission(
    p_user_id uuid,
    p_permission_id text,
    p_capability text,
    p_scope_type text,
    p_scope_value text
) is 'Vérifie si un utilisateur a une permission effective avec une capacité donnée dans un scope. Wrapper sur has_effective_capability.';

grant execute on function public.has_effective_permission(uuid, text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- FIN
-- ============================================================================