-- P4.4 — Correction revoke_role_permission : harmonisation des clés JSON.
-- Le RPC lisait une ligne role_permissions via to_jsonb(rp) (clés can_use/
-- can_manage/can_grant/can_delegate) mais calculait les nouvelles capacités
-- avec des clés 'use'/'manage'/... -> n'importe quelle révocation aboutissait à
-- la SUPPRESSION de la ligne (all false), y compris quand d'autres capacités
-- restaient actives. Signature inchangée ; gardes (autorité GRANT,
-- anti-auto-révocation, validation) conservées.

create or replace function public.revoke_role_permission(
    p_target_role_id text,
    p_permission_id  text,
    p_capabilities   text[],
    p_scope_type     text default 'global',
    p_scope_value    text default null
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
    v_actor_uid            uuid := auth.uid();
    v_actor_has_authority  boolean;
    v_cap                  text;
    v_existing_caps        jsonb;
    v_new_caps             jsonb;
    v_actor_has_target_role boolean;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifie';
    end if;

    -- 2. Valider les paramètres
    if p_target_role_id is null or p_target_role_id = '' then
        raise exception 'VALIDATION_ERREUR: role_id cible requis';
    end if;
    if p_permission_id is null or p_permission_id = '' then
        raise exception 'VALIDATION_ERREUR: permission_id requis';
    end if;
    if p_capabilities is null or array_length(p_capabilities, 1) = 0 then
        raise exception 'VALIDATION_ERREUR: Au moins une capability a revoquer requise';
    end if;

    for v_cap in select unnest(p_capabilities)
    loop
        if v_cap not in ('USE', 'MANAGE', 'GRANT', 'DELEGATE') then
            raise exception 'VALIDATION_ERREUR: Capability invalide: %', v_cap;
        end if;
    end loop;

    if p_scope_type not in ('global', 'role', 'user') then
        raise exception 'VALIDATION_ERREUR: scope_type invalide: %', p_scope_type;
    end if;

    -- 3. Vérifier rôle cible existe
    if not exists (select 1 from public.roles where id = p_target_role_id) then
        raise exception 'ROLE_INEXISTANT: Role cible introuvable: %', p_target_role_id;
    end if;

    -- 4. Vérifier permission cible existe
    if not exists (select 1 from public.permissions where id = p_permission_id) then
        raise exception 'PERMISSION_INEXISTANTE: Permission cible introuvable: %', p_permission_id;
    end if;

    -- 5. Vérifier autorité effective : GRANT sur rbac.role_permissions
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

    -- 6. ANTI-AUTO-RÉVOCATION : acteur a-t-il le rôle cible effectivement ?
    v_actor_has_target_role := public.has_role_effective(v_actor_uid, p_target_role_id);

    -- 7. Récupérer capabilities existantes (colonnes can_*)
    select to_jsonb(rp) - 'role_id' - 'permission_id' into v_existing_caps
    from public.role_permissions rp
    where rp.role_id = p_target_role_id
      and rp.permission_id = p_permission_id;

    if v_existing_caps is null then
        -- Rien à révoquer
        return;
    end if;

    -- 8. Calculer nouvelles capabilities : passer les demandées à false (clés can_*)
    v_new_caps := v_existing_caps;
    for v_cap in select unnest(p_capabilities)
    loop
        v_new_caps := v_new_caps || jsonb_build_object('can_' || lower(v_cap), false);
    end loop;

    -- 9. ANTI-AUTO-RÉVOCATION : sur son propre rôle effectif, interdire de retirer
    --    MANAGE, GRANT ou DELEGATE sur les permissions RBAC sensibles
    if v_actor_has_target_role then
        if p_permission_id in ('rbac.role_permissions', 'rbac.role_delegations', 'rbac.user_delegations', 'rbac.role_assignability') then
            for v_cap in select unnest(p_capabilities)
            loop
                if v_cap in ('MANAGE', 'GRANT', 'DELEGATE') then
                    raise exception 'AUTO_REVOCATION_INTERDITE: Impossible de revoquer sa propre capability % sur %', v_cap, p_permission_id;
                end if;
            end loop;
        end if;
    end if;

    -- 10. Mettre à jour (ou supprimer si toutes false)
    if (coalesce(v_new_caps->>'can_use', 'false')::boolean = false
        and coalesce(v_new_caps->>'can_manage', 'false')::boolean = false
        and coalesce(v_new_caps->>'can_grant', 'false')::boolean = false
        and coalesce(v_new_caps->>'can_delegate', 'false')::boolean = false) then
        delete from public.role_permissions
        where role_id = p_target_role_id
          and permission_id = p_permission_id;
    else
        update public.role_permissions
        set can_use = coalesce(v_new_caps->>'can_use', 'false')::boolean,
            can_manage = coalesce(v_new_caps->>'can_manage', 'false')::boolean,
            can_grant = coalesce(v_new_caps->>'can_grant', 'false')::boolean,
            can_delegate = coalesce(v_new_caps->>'can_delegate', 'false')::boolean
        where role_id = p_target_role_id
          and permission_id = p_permission_id;
    end if;

    return;
end;
$$;

revoke all on function public.revoke_role_permission(text, text, text[], text, text) from public;
grant execute on function public.revoke_role_permission(text, text, text[], text, text) to authenticated;