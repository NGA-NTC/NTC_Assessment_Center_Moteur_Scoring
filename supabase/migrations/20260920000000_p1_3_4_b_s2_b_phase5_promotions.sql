-- ============================================================================
-- P1.3.4-B-S2-B-PHASE5 — Sécurisation des promotions admin / super_admin
-- ============================================================================
-- Règle métier :
--   - users.change_role         : gère UNIQUEMENT les rôles ordinaires
--   - users.promote_admin       : requis pour attribuer le rôle admin
--   - users.promote_super_admin : requis pour attribuer le rôle super_admin
--
-- La règle est appliquée dans assign_user_role (attribution).
-- revoke_user_role reste inchangé : conforme à la Phase 4 (test R validé),
-- la révocation d'un rôle ne nécessite que GRANT users.change_role + scope.
--
-- Le rôle super_admin ne peut PAS être attribué via assign_user_role :
-- la contrainte role_assignability_no_self_assign_check interdit
-- ('super_admin' -> 'super_admin'); la création d'un super_admin passe
-- par bootstrap_super_admin (service / propriétaire), déjà révoquée
-- pour authenticated/anon.
--- ===========================================================================

-- ============================================================================
-- 1. RÈGLE BACKEND — promotion dans assign_user_role
-- ============================================================================
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
    v_required_promote_permission text;
    v_actor_has_promote_authority boolean;
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

    -- 7bis. RÈGLE DE PROMOTION — rôles à privilège
    -- L'attribution du rôle admin / super_admin est une promotion :
    --   admin        -> GRANT users.promote_admin requis
    --   super_admin  -> GRANT users.promote_super_admin requis
    -- users.change_role ne suffit PAS (rôles ordinaires uniquement).
    v_required_promote_permission := case p_role_id
        when 'admin' then 'users.promote_admin'
        when 'super_admin' then 'users.promote_super_admin'
        else null
    end;

    if v_required_promote_permission is not null then
        v_actor_has_promote_authority := public.has_effective_capability(
            v_actor_uid,
            'GRANT',
            v_required_promote_permission,
            'user',
            p_target_user_id::text
        );

        if not v_actor_has_promote_authority then
            raise exception 'PROMOTION_INTERDITE: GRANT sur % requis pour attribuer le rôle %', v_required_promote_permission, p_role_id;
        end if;
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
Promotion : attribuer admin exige users.promote_admin, attribuer super_admin exige users.promote_super_admin.
Anti-escalade : pas d''auto-attribution, scope couvert, pas de bypass super_admin.';

grant execute on function public.assign_user_role(uuid, text, timestamptz) to authenticated;
revoke execute on function public.assign_user_role(uuid, text, timestamptz) from anon;

-- ============================================================================
-- 2. SEEDS — Capacités GRANT des rôles de gestion
-- ============================================================================
-- super_admin (propriétaire) : GRANT effectif sur les 3 permissions de gestion
-- de rôles (ordinaires + promotions admin / super_admin).
-- admin : conserve le GRANT sur users.change_role pour gérer les rôles ordinaires.
insert into public.role_permissions (role_id, permission_id, can_use, can_manage, can_grant, can_delegate) values
  ('super_admin', 'users.change_role', true, true, true, false),
  ('super_admin', 'users.promote_admin', true, true, true, false),
  ('super_admin', 'users.promote_super_admin', true, true, true, false),
  ('admin', 'users.change_role', true, true, true, false)
on conflict (role_id, permission_id) do update set
  can_use = true,
  can_manage = true,
  can_grant = true;

-- ============================================================================
-- 3. SEEDS — Graphe d'assignabilité par défaut
-- ============================================================================
-- super_admin : gère candidate (rôles ordinaires) et admin (promotion, gate par promote_admin)
-- admin        : gère candidate (rôles ordinaires)
-- super_admin -> super_admin est interdit par role_assignability_no_self_assign_check :
-- la création d'un super_admin passe par bootstrap_super_admin (service / propriétaire).
insert into public.role_assignability (assigner_role_id, assignable_role_id, created_by)
select x.assigner_role_id, x.assignable_role_id, v_user.id
from (values
  ('super_admin', 'candidate'),
  ('super_admin', 'admin'),
  ('admin', 'candidate')
) as x(assigner_role_id, assignable_role_id)
cross join lateral (
  select id from auth.users order by created_at limit 1
) v_user
where v_user.id is not null
on conflict (assigner_role_id, assignable_role_id) do nothing;

-- ============================================================================
-- FIN PHASE 5
-- ============================================================================