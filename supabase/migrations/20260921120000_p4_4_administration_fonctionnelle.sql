-- P4.4 — Administration fonctionnelle & interface commune
-- Helper lecture : rôles assignables par l'acteur courant (UX comptes/utilisateurs).
-- La décision finale reste prise par les RPC assign_user_role / revoke_user_role.
-- Lecture seule ; n'ajoute aucun droit d'écriture.

create or replace function public.list_assignable_roles()
returns table (
    assignable_role_id   text,
    assignable_role_name text
)
language sql
stable
security definer
set search_path = 'public'
as $$
    select distinct
        ra.assignable_role_id,
        r.name as assignable_role_name
    from public.role_assignability ra
    join public.roles r on r.id = ra.assignable_role_id
    where r.is_assignable
      and public.has_role_effective(auth.uid(), ra.assigner_role_id)
    order by ra.assignable_role_id;
$$;

revoke all on function public.list_assignable_roles() from public;
grant execute on function public.list_assignable_roles() to authenticated;