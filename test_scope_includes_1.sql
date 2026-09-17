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
                  and ur.role_id = p_scope_type_a
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