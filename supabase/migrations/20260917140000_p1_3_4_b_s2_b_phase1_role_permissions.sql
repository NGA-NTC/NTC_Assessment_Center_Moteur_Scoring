-- ============================================================================
-- P1.3.4-B-S2-B-PHASE1 — Gestion sécurisée de role_permissions
-- ============================================================================

-- Extension UUID (déjà présente)
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PERMISSIONS RBAC — Configuration du moteur d'autorisation
-- ============================================================================

-- Ces permissions sont distinctes des permissions métier (users.*, profile.*, etc.)
-- Elles contrôlent l'accès à la configuration même du RBAC.
-- category = 'rbac' pour les distinguer clairement.

insert into public.permissions (id, name, description, category) values
  -- Gestion de la matrice rôle ↔ permission ↔ capabilities
  ('rbac.role_permissions', 'Gérer permissions rôles', 'Attribuer, modifier, retirer des capacités (USE/MANAGE/GRANT/DELEGATE) sur les permissions d''un rôle', 'rbac'),
  -- Gestion des délégations par rôle
  ('rbac.role_delegations', 'Gérer délégations rôles', 'Créer, révoquer, consulter les délégations de rôle (role_delegations)', 'rbac'),
  -- Gestion des délégations individuelles
  ('rbac.user_delegations', 'Gérer délégations users', 'Créer, révoquer, consulter les délégations individuelles (user_delegations)', 'rbac'),
  -- Gestion de l'assignabilité des rôles
  ('rbac.role_assignability', 'Gérer assignabilité rôles', 'Configurer quels rôles peuvent attribuer quels autres rôles (role_assignability)', 'rbac')
on conflict (id) do nothing;

-- ============================================================================
-- 2. ATTRIBUTION DES CAPACITÉS SUPER_ADMIN SUR LES PERMISSIONS RBAC
-- ============================================================================

-- Super Admin possède les 4 capacités sur toutes les permissions RBAC
-- Cela se fait via role_permissions.can_use, can_manage, can_grant, can_delegate

-- rbac.role_permissions
insert into public.role_permissions (role_id, permission_id, can_use, can_manage, can_grant, can_delegate) values
  ('super_admin', 'rbac.role_permissions', true, true, true, true)
on conflict (role_id, permission_id) do update set
  can_use = excluded.can_use,
  can_manage = excluded.can_manage,
  can_grant = excluded.can_grant,
  can_delegate = excluded.can_delegate;

-- rbac.role_delegations
insert into public.role_permissions (role_id, permission_id, can_use, can_manage, can_grant, can_delegate) values
  ('super_admin', 'rbac.role_delegations', true, true, true, true)
on conflict (role_id, permission_id) do update set
  can_use = excluded.can_use,
  can_manage = excluded.can_manage,
  can_grant = excluded.can_grant,
  can_delegate = excluded.can_delegate;

-- rbac.user_delegations
insert into public.role_permissions (role_id, permission_id, can_use, can_manage, can_grant, can_delegate) values
  ('super_admin', 'rbac.user_delegations', true, true, true, true)
on conflict (role_id, permission_id) do update set
  can_use = excluded.can_use,
  can_manage = excluded.can_manage,
  can_grant = excluded.can_grant,
  can_delegate = excluded.can_delegate;

-- rbac.role_assignability
insert into public.role_permissions (role_id, permission_id, can_use, can_manage, can_grant, can_delegate) values
  ('super_admin', 'rbac.role_assignability', true, true, true, true)
on conflict (role_id, permission_id) do update set
  can_use = excluded.can_use,
  can_manage = excluded.can_manage,
  can_grant = excluded.can_grant,
  can_delegate = excluded.can_delegate;

-- ============================================================================
-- 3. FONCTION RPC — grant_role_permission
-- ============================================================================
-- Ajoute ou met à jour une permission avec ses capacités pour un rôle donné.
-- Vérifications :
--   - Authentification
--   - Autorité effective : rbac.role_permissions + MANAGE dans le scope
--   - Scope demandé ⊆ scope détenu (via scope_includes)
--   - Anti-escalade : capabilities demandées ⊆ capabilities détenues par l'acteur
--   - Rôle cible et permission cible existent
--   - Pas d'auto-élévation de privilèges

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
    v_actor_caps text[];
    v_cap text;
    v_existing_caps jsonb;
    v_new_caps jsonb;
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

    -- 3. Vérifier que le rôle cible existe
    if not exists (select 1 from public.roles where id = p_target_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle cible introuvable: %', p_target_role_id;
    end if;

    -- 4. Vérifier que la permission cible existe
    if not exists (select 1 from public.permissions where id = p_permission_id) then
        raise exception 'PERMISSION_INEXISTANTE: Permission cible introuvable: %', p_permission_id;
    end if;

    -- 5. Vérifier l'autorité effective de l'acteur sur rbac.role_permissions + MANAGE
    -- Scope de l'acteur doit inclure le scope demandé
    v_actor_has_authority := public.has_effective_capability(
        v_actor_uid,
        'MANAGE',
        'rbac.role_permissions',
        p_scope_type,
        p_scope_value
    );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: MANAGE sur rbac.role_permissions requis dans le scope %:%', p_scope_type, coalesce(p_scope_value, 'global');
    end if;

    -- 6. ANTI-ESCALADE : Vérifier que l'acteur possède CHAQUE capability demandée
    -- sur la permission cible dans le scope demandé
    -- (On ne peut pas donner ce qu'on n'a pas soi-même)
    for v_cap in select key from jsonb_object_keys(p_capabilities) where value = 'true'
    loop
        -- Mapper la clé jsonb vers la capability canonique
        if not public.has_effective_capability(
            v_actor_uid,
            upper(v_cap),  -- 'use' -> 'USE', etc.
            p_permission_id,
            p_scope_type,
            p_scope_value
        ) then
            raise exception 'ESCALADE_INTERDITE: Vous ne possédez pas la capability % sur % dans ce scope', upper(v_cap), p_permission_id;
        end if;
    end loop;

    -- 7. ANTI-ESCALADE : Vérifier que le scope demandé est inclus dans le scope détenu
    -- pour la permission rbac.role_permissions (déjà fait par has_effective_capability via scope_includes)
    -- Mais on vérifie aussi explicitement pour la permission cible
    -- (si l'acteur a MANAGE sur rbac.role_permissions en scope global, il peut gérer n'importe quel scope)
    -- La vérification has_effective_capability ci-dessus couvre déjà cela.

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

    -- 11. Succès (audit futur : actor=v_actor_uid, action='grant_role_permission', etc.)
    return;
end;
$$;

comment on function public.grant_role_permission(text, text, jsonb, text, text) is
'Ajoute ou met à jour les capacités (USE/MANAGE/GRANT/DELEGATE) d''une permission pour un rôle.
Nécessite : authentification + MANAGE effectif sur rbac.role_permissions dans le scope demandé.
Anti-escalade : chaque capability demandée doit être détenue par l''acteur sur la permission cible dans le scope.';

grant execute on function public.grant_role_permission(text, text, jsonb, text, text) to authenticated;
revoke execute on function public.grant_role_permission(text, text, jsonb, text, text) from anon;

-- ============================================================================
-- 4. FONCTION RPC — revoke_role_permission
-- ============================================================================
-- Retire une ou plusieurs capacités d'une permission pour un rôle donné.
-- Vérifications similaires à grant_role_permission.
-- Ne permet pas de retirer sa propre dernière capability MANAGE/GRANT/DELEGATE
-- sur rbac.role_permissions (sauf super_admin explicite).

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
    v_is_self_revocation boolean := false;
    v_is_super_admin boolean;
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

    -- 3. Vérifier rôle cible existe
    if not exists (select 1 from public.roles where id = p_target_role_id) then
        raise exception 'ROLE_INEXISTANT: Rôle cible introuvable: %', p_target_role_id;
    end if;

    -- 4. Vérifier permission cible existe
    if not exists (select 1 from public.permissions where id = p_permission_id) then
        raise exception 'PERMISSION_INEXISTANTE: Permission cible introuvable: %', p_permission_id;
    end if;

    -- 5. Vérifier autorité effective : MANAGE sur rbac.role_permissions
    v_actor_has_authority := public.has_effective_capability(
        v_actor_uid,
        'MANAGE',
        'rbac.role_permissions',
        p_scope_type,
        p_scope_value
    );

    if not v_actor_has_authority then
        raise exception 'PERMISSION_INSUFFISANTE: MANAGE sur rbac.role_permissions requis dans le scope %:%', p_scope_type, coalesce(p_scope_value, 'global');
    end if;

    -- 6. ANTI-ESCALADE : Détecter auto-révocation dangereuse
    -- Si l'acteur révoque une capability qu'il utilise lui-même pour faire cette action
    -- Vérifier si l'acteur a ce rôle cible
    select exists (
        select 1 from public.user_roles ur
        where ur.user_id = v_actor_uid
          and ur.role_id = p_target_role_id
          and ur.revoked_at is null
          and (ur.expires_at is null or ur.expires_at > now())
    ) into v_is_self_revocation;

    -- Vérifier si l'acteur est super_admin (bypass pour bootstrap/maintenance)
    select public.has_role(v_actor_uid, 'super_admin') into v_is_super_admin;

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

    -- 9. ANTI-ESCALADE : Si auto-révocation et pas super_admin, interdire de retirer
    -- MANAGE, GRANT ou DELEGATE sur rbac.role_permissions (perte d'accès à cette fonction)
    if v_is_self_revocation and not v_is_super_admin then
        if p_permission_id = 'rbac.role_permissions' then
            for v_cap in select unnest(p_capabilities)
            loop
                if v_cap in ('MANAGE', 'GRANT', 'DELEGATE') then
                    raise exception 'AUTO_REVOCATION_INTERDITE: Impossible de révoquer sa propre capability % sur rbac.role_permissions', v_cap;
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
Nécessite : authentification + MANAGE effectif sur rbac.role_permissions dans le scope.
Anti-escalade : interdit l''auto-révocation de MANAGE/GRANT/DELEGATE sur rbac.role_permissions (sauf super_admin).';

grant execute on function public.revoke_role_permission(text, text, text[], text, text) to authenticated;
revoke execute on function public.revoke_role_permission(text, text, text[], text, text) from anon;

-- ============================================================================
-- 5. FONCTION RPC — get_role_permission (lecture, pour complétude)
-- ============================================================================
-- Retourne les capabilities effectives d'un rôle pour une permission.
-- Accessible à tout authentifié (lecture publique comme role_permissions_select_all).

create or replace function public.get_role_permission(
    p_role_id text,
    p_permission_id text
) returns jsonb
language sql
stable
set search_path = public
as $$
    select jsonb_build_object(
        'role_id', rp.role_id,
        'permission_id', rp.permission_id,
        'can_use', rp.can_use,
        'can_manage', rp.can_manage,
        'can_grant', rp.can_grant,
        'can_delegate', rp.can_delegate
    )
    from public.role_permissions rp
    where rp.role_id = p_role_id
      and rp.permission_id = p_permission_id;
$$;

comment on function public.get_role_permission(text, text) is
'Retourne les 4 capacités d''un rôle pour une permission donnée.';

grant execute on function public.get_role_permission(text, text) to authenticated;
revoke execute on function public.get_role_permission(text, text) from anon;

-- ============================================================================
-- FIN PHASE 1
-- ============================================================================