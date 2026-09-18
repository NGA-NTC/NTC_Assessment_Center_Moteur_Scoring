-- ============================================================================
-- P1.3.4-B-S2-B-PHASE3 — Gestion user_delegations et role_assignability
-- ============================================================================
-- Création et révocation des délégations individuelles + configuration assignability
-- Réutilise permissions existantes : rbac.user_delegations, rbac.role_assignability

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. RPC create_user_delegation
-- ============================================================================

create or replace function public.create_user_delegation(
    p_grantee_user_id uuid,
    p_permission_id text,
    p_delegation_type text,
    p_scope_type text default 'global',
    p_scope_value text default null,
    p_expires_at timestamptz default null,
    p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_uid uuid := auth.uid();
    v_actor_has_authority boolean;
    v_delegation_id uuid;
    v_grantee_has_role boolean;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Valider les paramètres d'entrée
    if p_grantee_user_id is null then
        raise exception 'VALIDATION_ERREUR: grantee_user_id requis';
    end if;
    if p_permission_id is null or p_permission_id = '' then
        raise exception 'VALIDATION_ERREUR: permission_id requis';
    end if;
    if p_delegation_type is null or p_delegation_type = '' then
        raise exception 'VALIDATION_ERREUR: delegation_type requis';
    end if;

    -- Valider delegation_type
    if p_delegation_type not in ('use', 'manage', 'grant') then
        raise exception 'VALIDATION_ERREUR: delegation_type invalide: %', p_delegation_type;
    end if;

    -- Valider scope_type
    if p_scope_type not in ('global', 'role', 'user') then
        raise exception 'VALIDATION_ERREUR: scope_type invalide: %', p_scope_type;
    end if;

    -- Valider expires_at
    if p_expires_at is not null and p_expires_at <= now() then
        raise exception 'VALIDATION_ERREUR: expires_at doit être dans le futur';
    end if;

    -- 3. Vérifier que le bénéficiaire existe
    if not exists (select 1 from auth.users where id = p_grantee_user_id) then
        raise exception 'VALIDATION_ERREUR: bénéficiaire introuvable';
    end if;

    -- 4. Pas d'auto-délégation
    if v_actor_uid = p_grantee_user_id then
        raise exception 'AUTO_DELEGATION_INTERDITE: Impossible de déléguer à soi-même';
    end if;

    -- 5. Vérifier que la permission cible existe
    if not exists (select 1 from public.permissions where id = p_permission_id) then
        raise exception 'PERMISSION_INEXISTANTE: Permission cible introuvable: %', p_permission_id;
    end if;

    -- 6. Vérifier autorité effective : DELEGATE sur rbac.user_delegations
    v_actor_has_authority := public.has_effective_capability(
        v_actor_uid,
        'DELEGATE',
        'rbac.user_delegations',
        p_scope_type,
        p_scope_value
    );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: DELEGATE sur rbac.user_delegations requis dans le scope %:%', p_scope_type, coalesce(p_scope_value, 'global');
    end if;

    -- 7. ANTI-ESCALADE : DELEGATE sur la permission cible
    if not public.has_effective_capability(
        v_actor_uid,
        'DELEGATE',
        p_permission_id,
        p_scope_type,
        p_scope_value
    ) then
        raise exception 'ESCALADE_INTERDITE: Vous ne possédez pas DELEGATE sur % dans ce scope', p_permission_id;
    end if;

    -- 8. ANTI-ESCALADE : GRANT sur la permission cible
    if not public.has_effective_capability(
        v_actor_uid,
        'GRANT',
        p_permission_id,
        p_scope_type,
        p_scope_value
    ) then
        raise exception 'ESCALADE_INTERDITE: Vous ne possédez pas GRANT sur % dans ce scope', p_permission_id;
    end if;

    -- 9. ANTI-ESCALADE : Capacité déléguée détenue par l'acteur
    -- La capacité déléguée doit être détenue par l'acteur
    if not public.has_effective_capability(
        v_actor_uid,
        upper(p_delegation_type),
        p_permission_id,
        p_scope_type,
        p_scope_value
    ) then
        raise exception 'ESCALADE_INTERDITE: Vous ne possédez pas la capability % sur % dans ce scope', upper(p_delegation_type), p_permission_id;
    end if;

    -- 10. ANTI-AUTO-ÉLÉVATION : Pas de délégation GRANT/DELEGATE sur permissions RBAC si acteur a rôle super_admin
    if p_delegation_type in ('grant', 'manage') then
        if public.has_role_effective(v_actor_uid, 'super_admin') then
            if p_permission_id in ('rbac.role_permissions', 'rbac.role_delegations', 'rbac.user_delegations', 'rbac.role_assignability') then
                raise exception 'AUTO_ELÉVATION_INTERDITE: Impossible de déléguer % sur %', p_delegation_type, p_permission_id;
            end if;
        end if;
    end if;

    -- 11. Créer la délégation
    insert into public.user_delegations (
        granter_user_id,
        grantee_user_id,
        permission_id,
        delegation_type,
        scope_type,
        scope_value,
        reason,
        expires_at
    ) values (
        v_actor_uid,
        p_grantee_user_id,
        p_permission_id,
        p_delegation_type,
        p_scope_type,
        p_scope_value,
        p_reason,
        p_expires_at
    ) returning id into v_delegation_id;

    return v_delegation_id;
end;
$$;

comment on function public.create_user_delegation(uuid, text, text, text, text, timestamptz, text) is
'Crée une délégation individuelle (user_delegations) de manière sécurisée.
Nécessite : DELEGATE sur rbac.user_delegations + DELEGATE + GRANT sur permission cible dans le scope.
Anti-escalade : capacité déléguée détenue, pas d''auto-élévation, granter_user_id = auth.uid().';

grant execute on function public.create_user_delegation(uuid, text, text, text, text, timestamptz, text) to authenticated;
revoke execute on function public.create_user_delegation(uuid, text, text, text, text, timestamptz, text) from anon;

-- ============================================================================
-- 2. RPC revoke_user_delegation
-- ============================================================================

create or replace function public.revoke_user_delegation(
    p_delegation_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_uid uuid := auth.uid();
    v_delegation record;
    v_actor_has_authority boolean;
    v_actor_is_granter boolean;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Vérifier délégation existe et n'est pas déjà révoquée
    select * into v_delegation
    from public.user_delegations
    where id = p_delegation_id
      and revoked_at is null;

    if not found then
        raise exception 'DELEGATION_INEXISTANTE: Délégation introuvable ou déjà révoquée';
    end if;

    -- 2. Vérifier si l'acteur est le créateur (granter)
    v_actor_is_granter := (v_delegation.granter_user_id = v_actor_uid);

    -- 3. Vérifier autorité effective : DELEGATE sur rbac.user_delegations
    -- L'acteur peut révoquer s'il est le créateur OU s'il a DELEGATE sur rbac.user_delegations dans le scope
    v_actor_has_authority := v_actor_is_granter
        or public.has_effective_capability(
            v_actor_uid,
            'DELEGATE',
            'rbac.user_delegations',
            v_delegation.scope_type,
            v_delegation.scope_value
        );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: Vous n''êtes pas autorisé à révoquer cette délégation';
    end if;

    -- 4. ANTI-AUTO-RÉVOCATION : Si l'acteur est le créateur (granter)
    -- interdire de révoquer une délégation donnant GRANT/MANAGE sur permissions RBAC sensibles
    if v_actor_is_granter then
        if v_delegation.permission_id in ('rbac.role_permissions', 'rbac.role_delegations', 'rbac.user_delegations', 'rbac.role_assignability')
           and v_delegation.delegation_type in ('grant', 'manage') then
            raise exception 'AUTO_REVOCATION_INTERDITE: Impossible de révoquer sa propre délégation % sur %', v_delegation.delegation_type, v_delegation.permission_id;
        end if;
    end if;

    -- 5. Révoquer la délégation
    update public.user_delegations
    set revoked_at = now(),
        revoked_by = v_actor_uid
    where id = p_delegation_id;

    return;
end;
$$;

comment on function public.revoke_user_delegation(uuid) is
'Révoque une délégation individuelle (user_delegations).
Nécessite : être le créateur (granter_user_id) OU DELEGATE sur rbac.user_delegations dans le scope.
Anti-auto-révocation : créateur ne peut pas révoquer sa propre délégation GRANT/MANAGE sur permissions RBAC sensibles.';

grant execute on function public.revoke_user_delegation(uuid) to authenticated;
revoke execute on function public.revoke_user_delegation(uuid) from anon;

-- ============================================================================
-- 3. RPC set_role_assignability
-- ============================================================================

create or replace function public.set_role_assignability(
    p_assigner_role_id text,
    p_assignable_role_id text,
    p_allow boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_uid uuid := auth.uid();
    v_actor_has_authority boolean;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Valider les paramètres
    if p_assigner_role_id is null or p_assigner_role_id = '' then
        raise exception 'VALIDATION_ERREUR: assigner_role_id requis';
    end if;
    if p_assignable_role_id is null or p_assignable_role_id = '' then
        raise exception 'VALIDATION_ERREUR: assignable_role_id requis';
    end if;

    -- 2. Rôles différents (CHECK existant mais validation explicite)
    if p_assigner_role_id = p_assignable_role_id then
        raise exception 'VALIDATION_ERREUR: Un rôle ne peut pas s''assigner lui-même';
    end if;

    -- 3. Vérifier que les deux rôles existent
    if not exists (select 1 from public.roles where id = p_assigner_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle assigner introuvable: %', p_assigner_role_id;
    end if;
    if not exists (select 1 from public.roles where id = p_assignable_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle assignable introuvable: %', p_assignable_role_id;
    end if;

    -- 4. Autorisation : DELEGATE sur rbac.role_assignability (scope global)
    v_actor_has_authority := public.has_effective_capability(
        v_actor_uid,
        'DELEGATE',
        'rbac.role_assignability',
        'global',
        null
    );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: DELEGATE sur rbac.role_assignability requis';
    end if;

    -- 5. Exécuter l'opération
    if p_allow then
        insert into public.role_assignability (assigner_role_id, assignable_role_id, created_by)
        values (p_assigner_role_id, p_assignable_role_id, v_actor_uid)
        on conflict (assigner_role_id, assignable_role_id) do nothing;
    else
        delete from public.role_assignability
        where assigner_role_id = p_assigner_role_id
          and assignable_role_id = p_assignable_role_id;
    end if;

    return;
end;
$$;

comment on function public.set_role_assignability(text, text, boolean) is
'Configure l''assignabilité des rôles (role_assignability).
Nécessite : DELEGATE sur rbac.role_assignability (scope global).
Aucun bypass super_admin par nom de rôle.';

grant execute on function public.set_role_assignability(text, text, boolean) to authenticated;
revoke execute on function public.set_role_assignability(text, text, boolean) from anon;

-- ============================================================================
-- FIN PHASE 3
-- ============================================================================