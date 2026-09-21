-- ============================================================================
-- P1.3.4-b S2-b Phase 6 (suite) : Correction collision paramètre/colonne
-- dans has_role() et has_permission().
--
-- Contexte : dans `has_role(user_id uuid, role_text text)`, le paramètre
-- `user_id` est DÉPASSÉ par la colonne `user_id` des tables jointes dans le
-- corps de la fonction : `ur.user_id = user_id` se résout en
-- `ur.user_id = ur.user_id` (toujours vrai pour une ligne non NULL).
-- Résultat : has_role() renvoyait true dès que LE RÔLE existait chez
-- QUELQU'UN, indépendamment de l'utilisateur testé. Idem pour has_permission().
--
-- Impact : toutes les policies structurelles de type `*_super_admin`
-- (catalogues, profiles insert/delete, role_assignability, role_delegations,
-- user_delegations) étaient de fait OUVERTES à tout utilisateur authentifié,
-- et get_effective_authority() autorisait la lecture de l'autorité d'autrui.
--
-- Correction : qualification explicite des paramètres par le nom de la
-- fonction (`has_role.user_id` / `has_role.role_text`, etc.) à l'intérieur du
-- corps SQL. Le nom des paramètres et la signature (uuid, text) sont
-- inchangés : CREATE OR REPLACE reste possible (idempotent), aucune politique
-- dépendante n'est impactée, aucun grant n'est perdu.
-- ============================================================================

create or replace function public.has_role(user_id uuid, role_text text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = has_role.user_id and r.id = has_role.role_text
  );
$$;

create or replace function public.has_permission(user_id uuid, perm_text text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = has_permission.user_id and p.id = has_permission.perm_text
  );
$$;

-- Les grants existants sont conservés par CREATE OR REPLACE (même OID).