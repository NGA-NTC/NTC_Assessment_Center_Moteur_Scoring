-- ============================================================================
-- P1.3.4-B-S2-B-PHASE1-FIX — Correction jsonb_object_keys dans grant_role_permission
-- ============================================================================
-- Correction de l'utilisation incorrecte de jsonb_object_keys() qui ne retourne
-- que les clés, pas les paires clé/valeur. Utilisation de jsonb_each_text() à la place.

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- CORRECTION grant_role_permission
-- ============================================================================

drop function if exists public.grant_role_permission(text, text, jsonb, text, text);

create or replace function public.grant_role_permission(
    p_target_role_id text,
    p_permission_id text,
    p_capabilities jsonb,
    p_scope_type text default 'global',
    p_scope_value text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_uid uuid := auth.uid();
    v_actor_has_authority boolean;
    v_requested_caps text[];
    v_cap text;
    v_existing_caps jsonb;
    v_new_caps jsonb;
    v_actor_has_target_role boolean;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Valider les paramètres d'entrée
    if p_target_role_id is null or p_target_role_id = '' then
        raise exception 'VALIDATION_ERREUR: role_id cible requis';
    end if;
    if p_permission_id is null or p_permission_id = '' then
        raise exception 'VALIDATION_ERREUR: permission_id requis';
    end if;
    if p_capabilities is null then
        raise exception 'VALIDATION_ERREUR: capabilities requis (jsonb)';
    end if;

    -- Valider que les clés sont parmi les 4 capabilities connues
    v_requested_caps := array(
        select kv.key
        from jsonb_each(p_capabilities) as kv(key, value)
        where kv.key not in ('use', 'manage', 'grant', 'delegate')
    );
    if array_length(v_requested_caps, 1) > 0 then
        raise exception 'VALIDATION_ERREUR: Capability invalide: %', v_requested_caps[1];
    end if;

    -- Valider que au moins une capability est demandée à true
    if not exists (
        select 1 from jsonb_each_text(p_capabilities) as kv(key, value)
        where kv.value = 'true'
    ) then
        raise exception 'VALIDATION_ERREUR: Au moins une capability doit être true';
    end if;

    -- Valider scope_type
    if p_scope_type not in ('global', 'role', 'user') then
        raise exception 'VALIDATION_ERREUR: scope_type invalide: %', p_scope_type;
    end if;

    -- 3. Vérifier que le rôle cible existe
    if not exists (select 1 from public.roles where id = p_target_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle cible introuvable: %', p_target_role_id;
    end if;

    -- 4. Vérifier que la permission cible existe
    if not exists (select 1 from public.permissions where id = p_permission_id) then
        raise exception 'PERMISSION_INEXISTANTE: Permission cible introuvable: %', p_permission_id;
    end if;

    -- 5. Vérifier l'autorité effective de l'acteur : GRANT sur rbac.role_permissions
    v_actor_has_authority := public.has_effective_capability(
        v_actor_uid,
        'GRANT',
        'rbac.role_permissions',
        p_scope_type,
        p_scope_value
    );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: GRANT sur rbac.role_permissions requis dans le scope %:%', p_scope_type, coalesce(p_scope_value, 'global');
    end if;

    -- 6. ANTI-ESCALADE : Vérifier que l'acteur possède CHAQUE capability demandée
    -- sur la permission cible dans le scope demandé
    for v_cap in
        select kv.key
        from jsonb_each_text(p_capabilities) as kv(key, value)
        where kv.value = 'true'
    loop
        if not public.has_effective_capability(
            v_actor_uid,
            upper(v_cap),
            p_permission_id,
            p_scope_type,
            p_scope_value
        ) then
            raise exception 'ESCALADE_INTERDITE: Vous ne possédez pas la capability % sur % dans ce scope', upper(v_cap), p_permission_id;
        end if;
    end loop;

    -- 7. ANTI-AUTO-ÉLÉVATION : Détecter si l'acteur a le rôle cible EFFECTIVEMENT
    -- (assignment direct uniquement — les délégations ne donnent pas de rôle)
    v_actor_has_target_role := public.has_role_effective(v_actor_uid, p_target_role_id);

    if v_actor_has_target_role then
        for v_cap in
            select kv.key
            from jsonb_each_text(p_capabilities) as kv(key, value)
            where kv.value = 'true'
        loop
            if v_cap in ('grant', 'delegate') then
                -- Vérifier si la permission cible est une permission RBAC sensible
                if p_permission_id in ('rbac.role_permissions', 'rbac.role_delegations', 'rbac.user_delegations', 'rbac.role_assignability') then
                    raise exception 'AUTO_ELÉVATION_INTERDITE: Impossible de s''accorder % sur %', v_cap, p_permission_id;
                end if;
            end if;
        end loop;
    end if;

    -- 8. Récupérer les capabilities existantes pour ce rôle/permission
    select to_jsonb(rp) - 'role_id' - 'permission_id' into v_existing_caps
    from public.role_permissions rp
    where rp.role_id = p_target_role_id
      and rp.permission_id = p_permission_id;

    -- 9. Calculer les nouvelles capabilities (merge : true l'emporte sur false)
    v_new_caps := coalesce(v_existing_caps, '{"use": false, "manage": false, "grant": false, "delegate": false}'::jsonb) || p_capabilities;

    -- 10. Upsert dans role_permissions
    insert into public.role_permissions (role_id, permission_id, can_use, can_manage, can_grant, can_delegate)
    values (
        p_target_role_id,
        p_permission_id,
        coalesce(v_new_caps->>'use', 'false')::boolean,
        coalesce(v_new_caps->>'manage', 'false')::boolean,
        coalesce(v_new_caps->>'grant', 'false')::boolean,
        coalesce(v_new_caps->>'delegate', 'false')::boolean
    )
    on conflict (role_id, permission_id) do update set
        can_use = excluded.can_use,
        can_manage = excluded.can_manage,
        can_grant = excluded.can_grant,
        can_delegate = excluded.can_delegate;

    -- 11. Succès
    return;
end;
$$;

comment on function public.grant_role_permission(text, text, jsonb, text, text) is
'Ajoute ou met à jour les capacités (USE/MANAGE/GRANT/DELEGATE) d''une permission pour un rôle.
Nécessite : authentification + GRANT effectif sur rbac.role_permissions dans le scope demandé.
Anti-escalade : chaque capability demandée doit être détenue par l''acteur sur la permission cible dans le scope.
Anti-auto-élévation : interdit d''accorder GRANT/DELEGATE sur permissions RBAC à un rôle détenu effectivement.';

grant execute on function public.grant_role_permission(text, text, jsonb, text, text) to authenticated;
revoke execute on function public.grant_role_permission(text, text, jsonb, text, text) from anon;

-- ============================================================================
-- FIN CORRECTION
-- ============================================================================