-- ============================================================================
-- P1.3.4-B-S2-B-PHASE2 — Gestion sécurisée de role_delegations
-- ============================================================================
-- Création et révocation sécurisées des délégations par rôle.
-- Réutilise la permission rbac.role_delegations existante (Phase 1).

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. RPC create_role_delegation
-- ============================================================================
-- Crée une délégation de rôle de manière sécurisée.
-- Vérifications :
--   - Authentification
--   - Rôle délégateur valide
--   - Rôle cible valide
--   - Permission cible existante
--   - delegation_type valide ('use' | 'manage' | 'grant')
--   - Scope valide
--   - Pas d'auto-délégation (delegator_role_id != target_role_id)
--   - Acteur autorisé : DELEGATE sur rbac.role_delegations + DELEGATE + GRANT sur permission cible
--   - Scope demandé couvert par autorité effective
--   - Anti-auto-élévation
--   - Expiration/révocation respectées

create or replace function public.create_role_delegation(
    p_delegator_role_id text,
    p_target_role_id text,
    p_permission_id text,
    p_delegation_type text,
    p_scope_type text default 'global',
    p_scope_value text default null,
    p_expires_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_uid uuid := auth.uid();
    v_actor_has_authority boolean;
    v_delegation_id uuid;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Valider les paramètres d'entrée
    if p_delegator_role_id is null or p_delegator_role_id = '' then
        raise exception 'VALIDATION_ERREUR: delegator_role_id requis';
    end if;
    if p_target_role_id is null or p_target_role_id = '' then
        raise exception 'VALIDATION_ERREUR: target_role_id requis';
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

    -- 3. Vérifier que le rôle délégateur existe
    if not exists (select 1 from public.roles where id = p_delegator_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle délégateur introuvable: %', p_delegator_role_id;
    end if;

    -- 4. Vérifier que le rôle cible existe
    if not exists (select 1 from public.roles where id = p_target_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle cible introuvable: %', p_target_role_id;
    end if;

    -- 5. Pas d'auto-délégation
    if p_delegator_role_id = p_target_role_id then
        raise exception 'AUTO_DELEGATION_INTERDITE: Impossible de déléguer à soi-même';
    end if;

    -- 6. Vérifier que la permission cible existe
    if not exists (select 1 from public.permissions where id = p_permission_id) then
        raise exception 'PERMISSION_INEXISTANTE: Permission cible introuvable: %', p_permission_id;
    end if;

    -- 7. Vérifier autorité effective : DELEGATE sur rbac.role_delegations
    v_actor_has_authority := public.has_effective_capability(
        v_actor_uid,
        'DELEGATE',
        'rbac.role_delegations',
        p_scope_type,
        p_scope_value
    );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: DELEGATE sur rbac.role_delegations requis dans le scope %:%', p_scope_type, coalesce(p_scope_value, 'global');
    end if;

    -- 8. ANTI-ESCALADE : Vérifier DELEGATE sur la permission cible
    -- L'acteur doit posséder DELEGATE sur la permission cible
    if not public.has_effective_capability(
        v_actor_uid,
        'DELEGATE',
        p_permission_id,
        p_scope_type,
        p_scope_value
    ) then
        raise exception 'ESCALADE_INTERDITE: Vous ne possédez pas DELEGATE sur % dans ce scope', p_permission_id;
    end if;

    -- 9. ANTI-ESCALADE : Vérifier GRANT sur la permission cible
    -- L'acteur doit posséder GRANT sur la permission cible
    if not public.has_effective_capability(
        v_actor_uid,
        'GRANT',
        p_permission_id,
        p_scope_type,
        p_scope_value
    ) then
        raise exception 'ESCALADE_INTERDITE: Vous ne possédez pas GRANT sur % dans ce scope', p_permission_id;
    end if;

    -- 10. ANTI-ESCALADE : Vérifier que le scope demandé est couvert
    -- Déjà couvert par has_effective_capability via scope_includes

    -- 11. ANTI-AUTO-ÉLÉVATION : Vérifier si l'acteur a le rôle délégateur EFFECTIVEMENT
    -- Si l'acteur a le rôle délégateur, interdire d'ajouter GRANT/DELEGATE sur permissions RBAC sensibles
    -- (via has_role_effective pour vérifier assignment direct)
    if p_delegation_type in ('grant', 'manage') then
        if public.has_role_effective(v_actor_uid, p_delegator_role_id) then
            if p_permission_id in ('rbac.role_permissions', 'rbac.role_delegations', 'rbac.user_delegations', 'rbac.role_assignability') then
                raise exception 'AUTO_ELÉVATION_INTERDITE: Impossible de déléguer % sur % via son propre rôle', p_delegation_type, p_permission_id;
            end if;
        end if;
    end if;

    -- 12. Créer la délégation
    insert into public.role_delegations (
        delegator_role_id,
        target_role_id,
        permission_id,
        delegation_type,
        scope_type,
        scope_value,
        created_by,
        expires_at
    ) values (
        p_delegator_role_id,
        p_target_role_id,
        p_permission_id,
        p_delegation_type,
        p_scope_type,
        p_scope_value,
        v_actor_uid,
        p_expires_at
    ) returning id into v_delegation_id;

    return v_delegation_id;
end;
$$;

comment on function public.create_role_delegation(text, text, text, text, text, text, timestamptz) is
'Crée une délégation de rôle (role_delegations) de manière sécurisée.
Nécessite : authentification + DELEGATE sur rbac.role_delegations + DELEGATE + GRANT sur la permission cible dans le scope demandé.
Anti-escalade : DELEGATE + GRANT requis sur permission cible. Anti-auto-élévation sur permissions RBAC sensibles.';

grant execute on function public.create_role_delegation(text, text, text, text, text, text, timestamptz) to authenticated;
revoke execute on function public.create_role_delegation(text, text, text, text, text, text, timestamptz) from anon;

-- ============================================================================
-- 2. RPC revoke_role_delegation
-- ============================================================================
-- Révoque une délégation de rôle.
-- Vérifications :
--   - Authentification
--   - Délégation existante
--   - Acteur autorisé : créateur de la délégation OU DELEGATE sur rbac.role_delegations
--   - Scope valide
--   - Anti-auto-révocation sur permissions RBAC sensibles

create or replace function public.revoke_role_delegation(
    p_delegation_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_uid uuid := auth.uid();
    v_actor_has_authority boolean;
    v_delegation record;
    v_actor_is_creator boolean;
    v_actor_has_delegator_role boolean;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Vérifier délégation existe
    select * into v_delegation
    from public.role_delegations
    where id = p_delegation_id
      and revoked_at is null;

    if not found then
        raise exception 'DELEGATION_INEXISTANTE: Délégation introuvable ou déjà révoquée';
    end if;

    -- 3. Vérifier si l'acteur est le créateur de la délégation
    v_actor_is_creator := (v_delegation.created_by = v_actor_uid);

    -- 4. Vérifier si l'acteur a le rôle délégateur EFFECTIVEMENT
    v_actor_has_delegator_role := public.has_role_effective(v_actor_uid, v_delegation.delegator_role_id);

    -- 5. Vérifier autorité effective : DELEGATE sur rbac.role_delegations
    -- L'acteur peut révoquer s'il est le créateur OU s'il a DELEGATE sur rbac.role_delegations dans le scope
    v_actor_has_authority := v_actor_is_creator
        or public.has_effective_capability(
            v_actor_uid,
            'DELEGATE',
            'rbac.role_delegations',
            v_delegation.scope_type,
            v_delegation.scope_value
        );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: Vous n''êtes pas autorisé à révoquer cette délégation';
    end if;

    -- 5. ANTI-AUTO-RÉVOCATION : Si l'acteur a le rôle délégateur effectif,
    -- interdire de révoquer une délégation qui donne GRANT/DELEGATE sur permissions RBAC sensibles
    if v_actor_has_delegator_role then
        if v_delegation.permission_id in ('rbac.role_permissions', 'rbac.role_delegations', 'rbac.user_delegations', 'rbac.role_assignability')
           and v_delegation.delegation_type in ('grant', 'manage') then
            raise exception 'AUTO_REVOCATION_INTERDITE: Impossible de révoquer sa propre délégation % sur %', v_delegation.delegation_type, v_delegation.permission_id;
        end if;
    end if;

    -- 6. Vérifier expiration/révocation de l'autorité de l'acteur
    -- has_effective_capability vérifie déjà cela

    -- 7. Révoquer la délégation
    update public.role_delegations
    set revoked_at = now(),
        revoked_by = v_actor_uid
    where id = p_delegation_id;

    return;
end;
$$;

comment on function public.revoke_role_delegation(uuid) is
'Révoque une délégation de rôle (role_delegations).
Nécessite : authentification + être le créateur OU DELEGATE sur rbac.role_delegations dans le scope.
Anti-auto-révocation : interdit de révoquer sa propre délégation donnant GRANT/DELEGATE sur permissions RBAC sensibles.';

grant execute on function public.revoke_role_delegation(uuid) to authenticated;
revoke execute on function public.revoke_role_delegation(uuid) from anon;

-- ============================================================================
-- FIN PHASE 2
-- ============================================================================