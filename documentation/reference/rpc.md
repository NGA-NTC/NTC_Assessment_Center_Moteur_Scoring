---
id: REF-RPC-001
title: Référence RPC
category: reference
status: implemented
version: 1.0.0
created_at: 2026-09-15
updated_at: 2026-09-15
source_of_truth: true
tags:
  - rpc
  - supabase
  - functions
---

# Référence RPC (Remote Procedure Calls)

Toutes les RPC sont `SECURITY DEFINER` + `SET search_path = public`.

---

## RPC existantes

### 1. `admin_get_users()`

**Migration :** `20260913_p1_2_4_admin_rpc_edge.sql`

```sql
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid uuid := auth.uid();
  has_admin_perm boolean;
  result jsonb;
BEGIN
  -- Vérifier admin/super_admin
  SELECT exists (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r on r.id = ur.role_id
    WHERE ur.user_id = caller_uid AND r.id in ('admin', 'super_admin')
  ) INTO has_admin_perm;

  IF not has_admin_perm THEN
    raise exception 'Accès réservé aux administrateurs';
  END IF;

  -- Récupération users + profils + rôles
  SELECT jsonb_agg(row_to_json(t)) INTO result
  FROM (
    SELECT u.id as user_id, u.email, u.email_confirmed_at, u.created_at as auth_created_at,
           p.first_name, p.last_name, p.phone, p.avatar_url, p.linkedin_url,
           p.job_title, p.location, p.bio, p.status,
           p.created_at as profile_created_at, p.updated_at as profile_updated_at,
           array_agg(distinct r.id) filter (where r.id is not null) as role_ids,
           array_agg(distinct r.name) filter (where r.name is not null) as role_names
    FROM auth.users u
    LEFT JOIN public.profiles p on p.id = u.id
    LEFT JOIN public.user_roles ur on ur.user_id = u.id
    LEFT JOIN public.roles r on r.id = ur.role_id
    GROUP BY u.id, p.id
    ORDER BY u.created_at desc
  ) t;

  RETURN coalesce(result, '[]'::jsonb);
END $$;
```

**Appel frontend :**
```js
const { data, error } = await supabase.rpc('admin_get_users');
// data = [{ user_id, email, first_name, last_name, role_ids: [], role_names: [], ... }, ...]
```

**Sécurité :** Vérifie rôle admin/super_admin via `user_roles` + `roles`.

---

### 2. `admin_reset_user_password(target_user_id uuid)`

**Migration :** `20260913_p1_2_4_admin_rpc_edge.sql`

```sql
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid uuid := auth.uid();
  has_perm boolean;
  target_email text;
BEGIN
  -- Vérifie permission users.change_role
  SELECT public.has_permission(caller_uid, 'users.change_role') INTO has_perm;
  IF not has_perm THEN
    raise exception 'Permission users.change_role requise';
  END IF;

  -- Récupère email cible
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  IF target_email is null THEN
    raise exception 'Utilisateur cible introuvable';
  END IF;

  -- Note: Envoi réel par Edge Function via service_role
  raise notice 'Reset password authorized for user %', target_user_id;
END $$;
```

**Appel frontend :**
```js
const { error } = await supabase.rpc('admin_reset_user_password', {
  target_user_id: userId
});
```

**Sécurité :** Vérifie `has_permission(caller_uid, 'users.change_role')`. L'envoi email réel est fait par Edge Function `admin-reset-password` avec `service_role`.

---

### 3. `bootstrap_super_admin(target_user_id uuid)`

**Migration :** `20260911210000_p1_2_1_security_fix.sql` (mis à jour `20260912_p1_2_2_super_admin_cleanup.sql`)

```sql
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_super_admin_count int;
BEGIN
  -- Vérifie qu'aucun super_admin n'existe
  SELECT count(*) INTO current_super_admin_count
  FROM public.user_roles ur JOIN public.roles r on r.id = ur.role_id
  WHERE r.id = 'super_admin';

  IF current_super_admin_count > 0 THEN
    raise exception 'Un super_admin existe déjà. Utilisez la procédure standard de promotion.';
  END IF;

  IF not exists (select 1 from auth.users where id = target_user_id) THEN
    raise exception 'Utilisateur cible introuvable.';
  END IF;

  -- Supprime rôle candidate si existe
  delete from public.user_roles where user_id = target_user_id and role_id = 'candidate';

  -- Assigne super_admin
  insert into public.user_roles (user_id, role_id, assigned_by)
  values (target_user_id, 'super_admin', target_user_id)
  on conflict (user_id, role_id) do update set role_id = 'super_admin';

  insert into public.profiles (id, email)
  select id, email from auth.users where id = target_user_id
  on conflict (id) do nothing;

  raise notice 'Super admin bootstrap effectué pour utilisateur %', target_user_id;
END $$;
```

**Usage :** Exécution manuelle via SQL Editor Supabase (une seule fois).

**Sécurité :** `GRANT EXECUTE` → `service_role` seulement. `REVOKE` pour `anon, authenticated, public`.

---

### 4. `promote_to_admin(target_user_id uuid)`

**Migration :** `20260911210000_p1_2_1_security_fix.sql`

```sql
CREATE OR REPLACE FUNCTION public.promote_to_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifie super_admin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Seul un super_admin peut promouvoir un administrateur.';
  end if;

  -- Vérifie permission users.promote_admin
  if not public.has_permission(auth.uid(), 'users.promote_admin') then
    raise exception 'Permission users.promote_admin requise.';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'Utilisateur cible introuvable.';
  end if;

  insert into public.user_roles (user_id, role_id, assigned_by)
  values (target_user_id, 'admin', auth.uid())
  on conflict (user_id, role_id) do update set role_id = 'admin';

  raise notice 'Utilisateur % promu en administrateur', target_user_id;
END $$;
```

**Appel frontend (futur RPC mutation) :**
```js
await supabase.rpc('promote_to_admin', { target_user_id: userId });
```

**Sécurité :** Vérifie `has_role(super_admin)` + `has_permission(users.promote_admin)`.

---

### 5. `has_role(user_id uuid, role_text text)`

**Migration :** `20260911210000_p1_2_1_security_fix.sql`

```sql
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, role_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r on r.id = ur.role_id
    WHERE ur.user_id = user_id and r.id = role_text
  );
$$;
```

**Usage :** Dans RLS policies, RPC, Edge Functions.

---

### 6. `has_permission(user_id uuid, perm_text text)`

**Migration :** `20260911210000_p1_2_1_security_fix.sql`

```sql
CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, perm_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp on rp.role_id = ur.role_id
    JOIN public.permissions p on p.id = rp.permission_id
    WHERE ur.user_id = user_id and p.id = perm_text
  );
$$;
```

**Usage :** RLS policies, RPC mutations, Edge Functions.

---

### 7. `has_role(required_role text)` — version sans user_id

**Migration :** `20260911210000_p1_2_1_security_fix.sql`

```sql
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role_id = required_role
  );
$$;
```

**Usage :** Frontend `useUserAuth().hasRole('admin')`, RLS policies.

---

### 8. `admin_reset_password(target_email text)` — Ancienne version

**Migration :** `20260913_p1_2_4_admin_rpc_edge.sql` (remplacée par `admin_reset_user_password`)

```sql
CREATE OR REPLACE FUNCTION public.admin_reset_password(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid uuid := auth.uid();
  is_admin boolean;
  target_user_id uuid;
BEGIN
  -- Vérifie admin/super_admin
  SELECT exists (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r on r.id = ur.role_id
    WHERE ur.user_id = caller_uid AND r.id in ('admin', 'super_admin')
  ) INTO is_admin;

  if not is_admin then raise exception 'Accès refusé : permissions administrateur requises'; end if;
  if not public.has_permission(caller_uid, 'users.change_role') then
    raise exception 'Permission users.change_role requise';
  end if;

  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  IF target_user_id IS NULL THEN raise exception 'Utilisateur introuvable'; END IF;

  perform auth.generate_recovery_link(target_email);
  raise notice 'Reset password authorized for user %', target_user_id;
END $$;
```

> **Obsolète** : Remplacée par `admin_reset_user_password(target_user_id uuid)` qui prend un UUID.

---

### 9. `get_admin_users()`

**Migration :** `20260913_p1_2_4_admin_rpc_edge.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid uuid := auth.uid();
  is_admin boolean;
  result jsonb;
BEGIN
  -- Vérifie admin/super_admin
  SELECT exists (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r on r.id = ur.role_id
    WHERE ur.user_id = caller_uid AND r.id in ('admin', 'super_admin')
  ) INTO is_admin;

  if not is_admin then raise exception 'Accès refusé : permissions administrateur requises'; end if;

  -- Récupération sans données sensibles auth.users
  WITH user_data as (
    SELECT u.id, u.email, u.email_confirmed_at, u.created_at as auth_created_at,
           p.first_name, p.last_name, p.phone, p.avatar_url, p.linkedin_url,
           p.job_title, p.location, p.bio, p.status, p.created_at as profile_created_at,
           p.updated_at as profile_updated_at,
           coalesce(array_agg(r.id) filter (where r.id is not null), '{}') as role_ids,
           coalesce(array_agg(r.name) filter (where r.name is not null), '{}') as role_names
    FROM auth.users u
    LEFT JOIN public.profiles p on p.id = u.id
    LEFT JOIN public.user_roles ur on ur.user_id = u.id
    LEFT JOIN public.roles r on r.id = ur.role_id
    GROUP BY u.id, p.id, p.first_name, p.last_name, p.phone, p.avatar_url,
             p.linkedin_url, p.job_title, p.location, p.bio, p.status,
             p.created_at, p.updated_at, u.email, u.email_confirmed_at, u.created_at
  )
  SELECT jsonb_agg(to_jsonb(ud) order by ud.auth_created_at desc)
  FROM user_data ud
  INTO result;

  RETURN coalesce(result, '[]'::jsonb);
END $$;
```

---

## RPC futures (PLANNED - P1.3.4)

| RPC | Description | Type |
|-----|-------------|------|
| `get_effective_authority(user_id, ...)` | Calcul autorité effective complète | Lecture |
| `has_effective_permission(user_id, perm, capability, scope_type, scope_value)` | Booléen pour RLS/UI | Lecture |
| `has_effective_capability(user_id, capability, scope_type, scope_value)` | Booléen pour RLS/UI | Lecture |
| `get_assignable_roles(user_id)` | Liste rôles attribuables | Lecture |
| `can_user_assign_role(user_id, target_role_id)` | Booléen | Lecture |
| `grant_role_to_user(granter_id, target_user_id, role_id)` | Mutation attribution rôle | Mutation |
| `revoke_role_from_user(granter_id, target_user_id, role_id)` | Mutation révocation rôle | Mutation |
| `create_role_delegation(...)` | Mutation délégation rôle | Mutation |
| `create_user_delegation(...)` | Mutation délégation individuelle | Mutation |
| `revoke_role_delegation(granter_id, delegation_id)` | Mutation révocation délégation rôle | Mutation |
| `revoke_user_delegation(granter_id, delegation_id)` | Mutation révocation délégation user | Mutation |

---

## Sécurité RPC

| Aspect | Implémentation |
|--------|----------------|
| `SECURITY DEFINER` | Toutes les RPC mutantes + lecture sensible |
| `SET search_path = public` | Toutes |
| `STABLE` | Pour fonctions lecture pure (`has_role`, `has_permission`) |
| Vérif auth interne | `auth.uid()`, `has_role`, `has_permission` |
| `GRANT EXECUTE` restrictif | `authenticated` (pas `anon`) pour sensibles |

---

## Appel frontend

```js
import { supabase } from '../lib/supabaseClient.js';

// RPC lecture
const { data, error } = await supabase.rpc('nom_fonction', { param1: 'value' });

// RPC mutation
const { data, error } = await supabase.rpc('mutation_fonction', { 
  param1: 'value',
  param2: 'value2'
});

// Gestion erreurs
if (error) {
  console.error('RPC Error:', error.message, error.details, error.hint);
  // Afficher message user-friendly
}
```

---

*Dernière mise à jour : 2026-09-15*