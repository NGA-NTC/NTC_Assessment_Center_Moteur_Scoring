-- P5 — Configuration de l'assignabilité des rôles (lecture UI /super-admin/acces)
-- Lecture complète du graphe role_assignability, réservée aux acteurs
-- disposant de DELEGATE sur rbac.role_assignability (garde identique à
-- set_role_assignability). L'écriture reste via set_role_assignability (RPC).
-- Lecture seule ; n'ajoute aucun droit d'écriture.

create or replace function public.list_role_assignability()
returns table (
    assigner_role_id   text,
    assignable_role_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'NON_AUTHENTIFIE: Utilisateur non authentifié';
    end if;

    if not public.has_effective_capability(
        auth.uid(), 'DELEGATE', 'rbac.role_assignability', 'global', null
    ) then
        raise exception 'PERMISSION_INSUFFISANTE: DELEGATE sur rbac.role_assignability requis';
    end if;

    return query
    select ra.assigner_role_id, ra.assignable_role_id
    from public.role_assignability ra
    order by ra.assigner_role_id, ra.assignable_role_id;
end;
$$;

comment on function public.list_role_assignability() is
'Retourne le graphe complet role_assignability (assigner_role_id, assignable_role_id).
Nécessite : DELEGATE sur rbac.role_assignability (scope global).';

revoke all on function public.list_role_assignability() from public, anon;
grant execute on function public.list_role_assignability() to authenticated;