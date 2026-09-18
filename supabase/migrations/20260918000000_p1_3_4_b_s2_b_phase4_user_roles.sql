-- ============================================================================
-- P1.3.4-B-S2-B-PHASE4 — Gestion sécurisée de user_roles
-- ============================================================================
-- Attribution et révocation sécurisées des rôles utilisateurs
-- Réutilise : has_effective_capability, scope_includes, has_role_effective, has_role

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. RPC assign_user_role
-- ============================================================================
-- Attribue un rôle à un utilisateur de manière sécurisée.
-- Vérifications :
--   - Authentification
--   - GRANT effectif sur users.change_role dans le scope
--   - role_assignability : l'acteur a le droit d'assigner ce rôle
--   - Rôle cible existant + is_assignable = true
--   - Scope demandé ⊆ scope détenu
--   - Pas d'auto-attribution
--   - Rôle de l'acteur actif (non expiré, non révoqué)
--   - Pas de bypass super_admin
--   - hierarchy_level ignoré

create or replace function public.assign_user_role(
    p_target_user_id uuid,
    p_role_id text,
    p_expires_at timestamptz default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_uid uuid := auth.uid();
    v_actor_has_authority boolean;
    v_actor_has_assignability boolean;
    v_target_role_exists boolean;
    v_target_role_assignable boolean;
    v_actor_has_target_role boolean;
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

    -- Valider expires_at
    if p_expires_at is not null and p_expires_at <= now() then
        raise exception 'VALIDATION_ERREUR: expires_at doit être dans le futur';
    end if;

    -- 3. Vérifier que l'utilisateur cible existe
    if not exists (select 1 from auth.users where id = p_target_user_id) then
        raise exception 'UTILISATEUR_INEXISTANT: Utilisateur cible introuvable';
    end if;

    -- 4. Vérifier que le rôle cible existe
    if not exists (select 1 from public.roles where id = p_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle cible introuvable: %', p_role_id;
    end if;

    -- 5. Vérifier is_assignable sur le rôle cible
    select is_assignable into v_target_role_assignable
    from public.roles
    where id = p_role_id;

    if not v_target_role_assignable then
        raise exception 'ROLE_NON_ASSIGNABLE: Le rôle % n''est pas assignable', p_role_id;
    end if;

    -- 6. Vérifier GRANT effectif sur users.change_role
    -- Le scope par défaut est 'user' avec la valeur de l'utilisateur cible
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

    -- 7. Vérifier role_assignability : l'acteur doit avoir un rôle actif qui peut assigner ce rôle
    -- L'assigner_role_id doit être un rôle ACTUELLEMENT attribué à l'acteur (has_role_effective)
    v_actor_has_assignability := exists (
        select 1
        from public.role_assignability ra
        where ra.assignable_role_id = p_role_id
          and public.has_role_effective(v_actor_uid, ra.assigner_role_id)
    );

    if not v_actor_has_assignability then
        raise exception 'ASSIGNABILITY_INTERDITE: Vous n''avez pas le droit d''assigner le rôle %', p_role_id;
    end if;

    -- 8. ANTI-AUTO-ATTRIBUTION
    if v_actor_uid = p_target_user_id then
        raise exception 'AUTO_ATTRIBUTION_INTERDITE: Impossible de s''attribuer un rôle à soi-même';
    end if;

    -- 9. ANTI-ESCALADE : Scope demandé doit être couvert
    -- Déjà vérifié par has_effective_capability via scope_includes

    -- 10. Vérifier que l'acteur a un rôle actif (non expiré, non révoqué)
    -- has_effective_capability vérifie déjà cela pour GRANT

    -- 11. Attribuer le rôle
    insert into public.user_roles (user_id, role_id, assigned_by, expires_at)
    values (p_target_user_id, p_role_id, v_actor_uid, p_expires_at)
    on conflict (user_id, role_id) do update set
        expires_at = excluded.expires_at,
        assigned_by = excluded.assigned_by,
        revoked_at = null,
        revoked_by = null;

    return;
end;
$$;

comment on function public.assign_user_role(uuid, text, timestamptz) is
'Attribue un rôle à un utilisateur.
Nécessite : GRANT sur users.change_role + role_assignability + scope utilisateur.
Anti-escalade : pas d''auto-attribution, scope couvert, pas de bypass super_admin.';

grant execute on function public.assign_user_role(uuid, text, timestamptz) to authenticated;
revoke execute on function public.assign_user_role(uuid, text, timestamptz) from anon;

-- ============================================================================
-- 2. RPC revoke_user_role
-- ============================================================================
-- Révoque un rôle d'un utilisateur.
-- Vérifications :
--   - Authentification
--   - GRANT sur users.change_role dans le scope
--   - Scope demandé couvert
--   - Pas d'auto-révocation si perte de dernier GRANT users.change_role
--   - Pas de bypass super_admin
--   - role_assignability NON requis pour la révocation

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

    return;
end;
$$;

comment on function public.revoke_user_role(uuid, text) is
'Révoque un rôle d''un utilisateur.
Nécessite : GRANT sur users.change_role + scope utilisateur.
Anti-auto-révocation : interdit de révoquer son dernier rôle donnant GRANT sur users.change_role.
Pas de bypass super_admin.';

grant execute on function public.revoke_user_role(uuid, text) to authenticated;
revoke execute on function public.revoke_user_role(uuid, text) from anon;

-- ============================================================================
-- FIN PHASE 4
-- ============================================================================