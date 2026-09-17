-- ============================================================================
-- P1.3.4-B-S2-B-PHASE1-CORRECTION-V2 — Correction rôle effectif + RLS
-- ============================================================================
-- 1. Crée la primitive has_role_effective()
-- 2. Corrige grant_role_permission et revoke_role_permission pour l'utiliser
-- 3. Corrige la RLS sur role_permissions (supprime USING(true))
-- 4. NE MODIFIE PAS get_role_permission (déjà correcte)
-- 5. NE MODIFIE PAS les données métier

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PRIMITIVE : has_role_effective
-- ============================================================================
-- Détermine si un utilisateur possède effectivement un rôle.
-- Sources : user_roles direct (actif, non expiré, non révoqué).
-- Les délégations ne donnent PAS de rôle (elles donnent des capabilities sur permissions).

create or replace function public.has_role_effective(
    p_user_id uuid,
    p_role_id text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Validation
    if p_user_id is null then
        return false;
    end if;
    if p_role_id is null or p_role_id = '' then
        return false;
    end if;

    -- Vérifier rôle direct actif
    return exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_user_id
          and ur.role_id = p_role_id
          and ur.revoked_at is null
          and (ur.expires_at is null or ur.expires_at > now())
    );
end;
$$;

comment on function public.has_role_effective(uuid, text) is
'Vérifie si un utilisateur possède un rôle effectivement (assignment direct actif).
Les délégations ne donnent pas de rôle — elles donnent des capabilities sur permissions.';

grant execute on function public.has_role_effective(uuid, text) to authenticated;
revoke execute on function public.has_role_effective(uuid, text) from anon;

-- ============================================================================
-- 2. CORRECTION grant_role_permission
-- ============================================================================

drop function if exists public.grant_role_permission(text, text, jsonb, text, text);

create or replace function public.grant_role_permission(
    p_target_role_id text,
    p_permission_id text,
    p_capabilities jsonb,        -- {"use": true, "manage": false, "grant": true, "delegate": false}
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
        select key from jsonb_object_keys(p_capabilities) as key
        where key not in ('use', 'manage', 'grant', 'delegate')
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
    for v_cap in select key from jsonb_object_keys(p_capabilities) where value = 'true'
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
        for v_cap in select key from jsonb_object_keys(p_capabilities) where value = 'true'
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
-- 3. CORRECTION revoke_role_permission
-- ============================================================================

drop function if exists public.revoke_role_permission(text, text, text[], text, text);

create or replace function public.revoke_role_permission(
    p_target_role_id text,
    p_permission_id text,
    p_capabilities text[],       -- ['USE', 'MANAGE', 'GRANT', 'DELEGATE'] à mettre à false
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
    v_cap text;
    v_existing_caps jsonb;
    v_new_caps jsonb;
    v_actor_has_target_role boolean;
begin
    -- 1. Vérifier authentification
    if v_actor_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Valider les paramètres
    if p_target_role_id is null or p_target_role_id = '' then
        raise exception 'VALIDATION_ERREUR: role_id cible requis';
    end if;
    if p_permission_id is null or p_permission_id = '' then
        raise exception 'VALIDATION_ERREUR: permission_id requis';
    end if;
    if p_capabilities is null or array_length(p_capabilities, 1) = 0 then
        raise exception 'VALIDATION_ERREUR: Au moins une capability à révoquer requise';
    end if;

    -- Valider que les capabilities sont parmi les 4 connues
    for v_cap in select unnest(p_capabilities)
    loop
        if v_cap not in ('USE', 'MANAGE', 'GRANT', 'DELEGATE') then
            raise exception 'VALIDATION_ERREUR: Capability invalide: %', v_cap;
        end if;
    end loop;

    -- Valider scope_type
    if p_scope_type not in ('global', 'role', 'user') then
        raise exception 'VALIDATION_ERREUR: scope_type invalide: %', p_scope_type;
    end if;

    -- 3. Vérifier rôle cible existe
    if not exists (select 1 from public.roles where id = p_target_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle cible introuvable: %', p_target_role_id;
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

    -- 6. ANTI-AUTO-RÉVOCATION : Détecter si l'acteur a le rôle cible EFFECTIVEMENT
    -- (assignment direct uniquement — les délégations ne donnent pas de rôle)
    v_actor_has_target_role := public.has_role_effective(v_actor_uid, p_target_role_id);

    -- 7. Récupérer capabilities existantes
    select to_jsonb(rp) - 'role_id' - 'permission_id' into v_existing_caps
    from public.role_permissions rp
    where rp.role_id = p_target_role_id
      and rp.permission_id = p_permission_id;

    if v_existing_caps is null then
        -- Rien à révoquer
        return;
    end if;

    -- 8. Calculer nouvelles capabilities (mettre les demandées à false)
    v_new_caps := v_existing_caps;
    for v_cap in select unnest(p_capabilities)
    loop
        v_new_caps := v_new_caps || jsonb_build_object(lower(v_cap), false);
    end loop;

    -- 9. ANTI-AUTO-RÉVOCATION : Si l'acteur a le rôle cible effectif,
    -- interdire de retirer MANAGE, GRANT ou DELEGATE sur les permissions RBAC sensibles
    -- S'applique à TOUS, y compris Super Admin (pas de bypass par nom de rôle)
    if v_actor_has_target_role then
        if p_permission_id in ('rbac.role_permissions', 'rbac.role_delegations', 'rbac.user_delegations', 'rbac.role_assignability') then
            for v_cap in select unnest(p_capabilities)
            loop
                if v_cap in ('MANAGE', 'GRANT', 'DELEGATE') then
                    raise exception 'AUTO_REVOCATION_INTERDITE: Impossible de révoquer sa propre capability % sur %', v_cap, p_permission_id;
                end if;
            end loop;
        end if;
    end if;

    -- 10. Mettre à jour (ou supprimer si toutes false)
    if (coalesce(v_new_caps->>'use', 'false')::boolean = false
        and coalesce(v_new_caps->>'manage', 'false')::boolean = false
        and coalesce(v_new_caps->>'grant', 'false')::boolean = false
        and coalesce(v_new_caps->>'delegate', 'false')::boolean = false) then
        -- Toutes false : supprimer la ligne
        delete from public.role_permissions
        where role_id = p_target_role_id
          and permission_id = p_permission_id;
    else
        update public.role_permissions
        set can_use = coalesce(v_new_caps->>'use', 'false')::boolean,
            can_manage = coalesce(v_new_caps->>'manage', 'false')::boolean,
            can_grant = coalesce(v_new_caps->>'grant', 'false')::boolean,
            can_delegate = coalesce(v_new_caps->>'delegate', 'false')::boolean
        where role_id = p_target_role_id
          and permission_id = p_permission_id;
    end if;

    -- 11. Succès
    return;
end;
$$;

comment on function public.revoke_role_permission(text, text, text[], text, text) is
'Retire des capacités (USE/MANAGE/GRANT/DELEGATE) d''une permission pour un rôle.
Nécessite : authentification + GRANT effectif sur rbac.role_permissions dans le scope.
Anti-auto-révocation : interdit de retirer MANAGE/GRANT/DELEGATE sur permissions RBAC sensibles
si l''acteur a le rôle cible effectivement (assignment direct). S''applique à tous, Super Admin inclus.';

grant execute on function public.revoke_role_permission(text, text, text[], text, text) to authenticated;
revoke execute on function public.revoke_role_permission(text, text, text[], text, text) from anon;

-- ============================================================================
-- 4. CORRECTION RLS — role_permissions
-- ============================================================================
-- Supprime la policy USING(true) qui permet à tout authenticated de lire toute la matrice
-- Remplace par une policy restrictive (super_admin seulement pour lecture directe)
-- La lecture autorisée pour les autres passe par get_role_permission() (SECURITY DEFINER)

-- Supprimer l'ancienne policy permissive
drop policy if exists "role_permissions_select_all" on public.role_permissions;

-- Nouvelle policy : lecture directe seulement pour super_admin
-- (get_role_permission contourne RLS car SECURITY DEFINER et fait ses propres checks)
create policy "role_permissions_select_super_admin"
on public.role_permissions for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

-- Les policies d'écriture existantes (admin/super_admin) restent inchangées

-- ============================================================================
-- FIN CORRECTION V2
-- ============================================================================