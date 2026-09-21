-- ============================================================================
-- P4.3 — Phase 7 : Correction de sécurité des actions d'administration
-- ============================================================================
-- Constats (tests réels JWT, phase P4.3) :
--   1. supabase.auth.admin.createUser depuis un client publishable ⇒
--      « User not allowed » : « Créer un compte » inutilisable dans le
--      navigateur ET aucune autorité users.manage/use effective côté backend.
--   2. supabase.auth.admin.updateUserById (Activer/Désactiver) ⇒ même
--      « User not allowed » : aucune autorité users.edit/use effective.
-- Consigne : migration ciblée UNIQUEMENT pour corriger la sécurité ;
-- conserver les RPC/services existants.
-- Livraison :
--   * admin_create_user      → SECURITY DEFINER, autorité users.manage USE
--     (global), crée le compte dans auth.users + auth.identities (bcrypt,
--     schéma GoTrue), retourne l'UUID du nouvel utilisateur.
--   * admin_set_user_active  → SECURITY DEFINER, autorité users.edit USE
--     (global), ban/réactive un compte (banned_until, convention GoTrue
--     « 87600h ») et synchronise profiles.status.
-- Le rôle candidat + le profil sont créés par le trigger existant
-- handle_new_user (on_auth_user_created) dès l'insertion dans auth.users.
-- Aucune permission ni RLS nouvelle : uniquement des exécutables grantés à
-- authenticated (mécanisme idempotent, révocable).
-- ============================================================================

create extension if not exists "pgcrypto";

begin;

-- ============================================================================
-- 1. RPC admin_create_user
-- ============================================================================
-- Crée un compte utilisateur confirmé (email_confin), hash bcrypt compatible
-- GoTrue ($2a$10$), identité provider 'email' miroir du pattern GoTrue,
-- puis laisse le trigger existant créer profil + rôle candidat.
-- Autorité : has_effective_capability(actor, 'USE', 'users.manage', 'global', NULL)
-- (portée : permission users.manage, capacité USE, scope global).

create or replace function public.admin_create_user(
    p_email text,
    p_password text,
    p_first_name text default '',
    p_last_name text default ''
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
    v_caller_uid uuid := auth.uid();
    v_has_permission boolean;
    v_email text;
    v_new_id uuid := gen_random_uuid();
begin
    -- 1. Authentification obligatoire
    if v_caller_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Autorité effective : users.manage USE (global)
    select public.has_effective_capability(
               v_caller_uid, 'USE', 'users.manage', 'global', NULL
           )
    into v_has_permission;

    if not v_has_permission then
        raise exception 'ACCES_REFUSE: users.manage USE requis pour créer un compte';
    end if;

    -- 3. Validation des paramètres
    v_email := lower(trim(coalesce(p_email, '')));
    if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'VALIDATION_ERREUR: email invalide';
    end if;
    if p_password is null or length(p_password) < 6 then
        raise exception 'VALIDATION_ERREUR: mot de passe trop court (min 6 caractères)';
    end if;

    -- 4. Unicité de l'email (auth.users, insensible à la casse)
    if exists (select 1 from auth.users where lower(email) = v_email) then
        raise exception 'EMAIL_DEJA_UTILISE: un compte existe déjà avec cet email';
    end if;

    -- 5. Insertion dans auth.users (miroir du pattern GoTrue admin)
    insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current,
        reauthentication_token,
        is_sso_user, is_anonymous
    ) values (
        '00000000-0000-0000-0000-000000000000',
        v_new_id,
        'authenticated',
        'authenticated',
        v_email,
        extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object(
            'sub', v_new_id::text,
            'email', v_email,
            'email_verified', true,
            'phone_verified', false,
            'first_name', coalesce(p_first_name, ''),
            'last_name', coalesce(p_last_name, '')
        ),
        now(), now(),
        '', '', '', '', '', '', '',
        '',
        false, false
    );

    -- 6. Identité provider 'email' (pattern GoTrue observé sur comptes existants)
    insert into auth.identities (
        provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
        v_new_id::text,
        v_new_id,
        jsonb_build_object(
            'sub', v_new_id::text,
            'email', v_email,
            'email_verified', false,
            'phone_verified', false
        ),
        'email', now(), now()
    );

    -- 7. Compléter le profil créé par le trigger (prénom / nom du formulaire)
    update public.profiles
    set first_name = coalesce(p_first_name, ''),
        last_name = coalesce(p_last_name, '')
    where id = v_new_id;

    return jsonb_build_object('user_id', v_new_id, 'email', v_email);
end $function$;

grant execute on function public.admin_create_user(text, text, text, text) to authenticated;
revoke execute on function public.admin_create_user(text, text, text, text) from anon;

comment on function public.admin_create_user(text, text, text, text) is
'Crée un compte utilisateur. Nécessite users.manage USE (global).';

-- ============================================================================
-- 2. RPC admin_set_user_active
-- ============================================================================
-- Active / désactive un compte :
--   * p_active = true  → banned_until = NULL, profiles.status = 'active'
--   * p_active = false → banned_until = now()+87600h, profiles.status = 'inactive'
-- Autorité : has_effective_capability(actor, 'USE', 'users.edit', 'global', NULL).

create or replace function public.admin_set_user_active(
    p_target_user_id uuid,
    p_active boolean
) returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
    v_caller_uid uuid := auth.uid();
    v_has_permission boolean;
begin
    -- 1. Authentification obligatoire
    if v_caller_uid is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    -- 2. Autorité effective : users.edit USE (global)
    select public.has_effective_capability(
               v_caller_uid, 'USE', 'users.edit', 'global', NULL
           )
    into v_has_permission;

    if not v_has_permission then
        raise exception 'ACCES_REFUSE: users.edit USE requis pour modifier le statut';
    end if;

    -- 3. Validation des paramètres
    if p_target_user_id is null then
        raise exception 'VALIDATION_ERREUR: target_user_id requis';
    end if;

    -- 4. La cible doit exister (auth.users)
    if not exists (select 1 from auth.users where id = p_target_user_id) then
        raise exception 'UTILISATEUR_INEXISTANT: Utilisateur cible introuvable';
    end if;

    -- 5. Ban / unban (convention GoTrue « 87600h » conservée)
    update auth.users
    set banned_until = case
            when p_active then null
            else now() + interval '87600 hours'
        end,
        updated_at = now()
    where id = p_target_user_id;

    -- 6. Synchroniser le statut affiché (profiles.status, contrainte
    --    active/inactive/suspended)
    update public.profiles
    set status = case when p_active then 'active' else 'inactive' end,
        updated_at = now()
    where id = p_target_user_id;

    return;
end $function$;

grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;
revoke execute on function public.admin_set_user_active(uuid, boolean) from anon;

comment on function public.admin_set_user_active(uuid, boolean) is
'Active/désactive un compte. Nécessite users.edit USE (global).';

commit;