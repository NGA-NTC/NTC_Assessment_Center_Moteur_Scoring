# P1.3.4-B-S2-B-PHASE1-TARGETED-AUDIT

## RÉSUMÉ EXÉCUTIF

**STATUT : NO_GO_PHASE2**

**Problème critique découvert** : L'expression `has_effective_capability(user_id, 'USE', 'role', 'role', target_role_id)` utilisée dans les deux RPC corrigées **ne fonctionne pas** et **retournera toujours FALSE** car il n'existe **aucune permission** avec `id = 'role'` dans la base de données.

---

## 1. SÉMANTIQUE DE `has_effective_capability(..., 'USE', 'role', 'role', target_role_id)`

### Code S1 analysé (`has_effective_capability`, lignes 73-167)

La fonction vérifie 3 sources d'autorité pour une permission donnée `p_permission_id` :

1. **Permissions directes** (lignes 94-109) : 
   ```sql
   join public.permissions p on p.id = rp.permission_id
   where ... p.id = p_permission_id
   ```

2. **Délégations de rôle** (lignes 120-141) :
   ```sql
   join public.permissions p on p.id = rd.permission_id
   where ... rd.permission_id = p_permission_id
   ```

3. **Délégations utilisateur** (lignes 148-162) :
   ```sql
   join public.permissions p on p.id = ud.permission_id
   where ... ud.permission_id = p_permission_id
   ```

### Constat

| Paramètre | Valeur passée | Existe dans `public.permissions` ? |
|---|---|---|
| `p_permission_id` | `'role'` | **NON** |

**Aucune migration n'insère de permission avec `id = 'role'`.**

Les permissions existantes sont :
- `users.*`, `profile.*`, `assessment.*`, `results.*`, `reports.*`
- `rbac.role_permissions`, `rbac.role_delegations`, `rbac.user_delegations`, `rbac.role_assignability`

### Comportement réel

```sql
has_effective_capability(uid, 'USE', 'role', 'role', 'admin')
```
→ Parcourt les 3 sources → **toutes retournent FALSE** (jointure sur `permissions` échoue car `p.id = 'role'` n'existe pas)
→ Retourne **FALSE** systématiquement

### Comportement attendu (intention du développeur)

L'intention était : « l'utilisateur possède effectivement le rôle `target_role_id` »

### Divergence

| Aspect | Attendu | Réel |
|---|---|---|
| « User a le rôle admin » | TRUE si user_roles contient (uid, 'admin') actif | **FALSE** toujours |
| Détection rôle direct | Devrait marcher | **Échoue** |
| Détection rôle via délégation | Devrait marcher | **Échoue** |

**Gravité : BLOQUANT** — Les protections anti-auto-élévation et anti-auto-révocation **ne s'activent jamais**.

---

## 2. CHEMIN EXACT D'AUTORITÉ EFFECTIVE

### Ce qui existe et fonctionne ✅

| Source | Table | Vérifiée par `has_effective_capability` ? |
|---|---|---|
| Rôles directs (user_roles) | `user_roles` → `role_permissions` → `permissions` | ✅ Oui |
| Délégations de rôle reçues | `user_roles` → `role_delegations` (target_role_id) | ✅ Oui |
| Délégations user reçues | `user_delegations` (grantee_user_id) | ✅ Oui |
| Expiration/Révocation | `expires_at`, `revoked_at` sur toutes tables | ✅ Oui |

### Ce qui MANQUE pour « a le rôle X »

Il n'y a **aucune primitive** dans S1 qui dise « user a le rôle X » (direct ou via délégation).

`has_effective_capability` répond à : « user a capability Y sur permission Z dans scope S »

Pour « user a rôle X », il faut :
- Soit une requête directe sur `user_roles` (rôle direct seulement)
- Soit `scope_includes('role', 'X', 'user', uid)` (rôle direct seulement)
- Soit `get_effective_authority(uid)` et filtrer source='role' (rôle direct + délégations)

### Preuve : `scope_includes` (lignes 36-49)

```sql
if p_scope_type_a = 'role' and p_scope_type_b = 'user' then
    return exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_scope_value_b::uuid
          and ur.role_id = p_scope_value_a
          and ur.revoked_at is null
          and (ur.expires_at is null or ur.expires_at > now())
    );
end if;
```

→ Ne vérifie que `user_roles` direct, **PAS** les délégations reçues.

---

## 3. VÉRIFICATION DES DEUX USAGES DANS LA CORRECTION

### grant_role_permission (ligne 122-123 correction)

```sql
v_actor_has_target_role := public.has_effective_capability(
    v_actor_uid, 'USE', 'role', 'role', p_target_role_id
);
```

**Résultat : TOUJOURS FALSE** → Protection anti-auto-élévation **inactive**

### revoke_role_permission (ligne 260-261 correction)

```sql
v_actor_has_target_role := public.has_effective_capability(
    v_actor_uid, 'USE', 'role', 'role', p_target_role_id
);
```

**Résultat : TOUJOURS FALSE** → Protection anti-auto-révocation **inactive**

---

## 4. get_role_permission — RESPECT DU SCOPE

### Code analysé (correction ligne 367-398)

```sql
v_actor_has_authority := public.has_effective_capability(v_actor_uid, 'USE', 'rbac.role_permissions', p_scope_type, p_scope_value)
                      or public.has_effective_capability(v_actor_uid, 'MANAGE', 'rbac.role_permissions', p_scope_type, p_scope_value)
                      or public.has_effective_capability(v_actor_uid, 'GRANT', 'rbac.role_permissions', p_scope_type, p_scope_value)
                      or public.has_effective_capability(v_actor_uid, 'DELEGATE', 'rbac.role_permissions', p_scope_type, p_scope_value);
```

### Analyse par scope

| Scope demandé | `has_effective_capability` comportement | Respecté ? |
|---|---|---|
| `global` | Vérifie si acteur a cap sur `rbac.role_permissions` scope global | ✅ Oui |
| `role:X` | Vérifie si acteur a cap sur `rbac.role_permissions` scope `role:X` → via `scope_includes(scope_acteur, scope_demandé)` | ✅ Oui (si scope_acteur ⊃ role:X) |
| `user:U` | Vérifie si acteur a cap sur `rbac.role_permissions` scope `user:U` → via `scope_includes(scope_acteur, 'user', U)` | ✅ Oui (si scope_acteur ⊃ user:U) |

**Le scope EST respecté correctement** grâce à `has_effective_capability` qui utilise `scope_includes` internement.

**MAIS** : la permission `rbac.role_permissions` a une policy RLS `USING(true)` pour SELECT (voir §7).

---

## 5. PROBLÈME RLS SUR `role_permissions`

### Policy existante (migration 20260911, ligne 212-215)

```sql
create policy "role_permissions_select_all"
on public.role_permissions for select
to authenticated
using (true);
```

### Conséquence

| Méthode d'accès | Contrôle d'autorisation | Peut contourner get_role_permission ? |
|---|---|---|
| `SELECT * FROM role_permissions` | **AUCUN** (USING(true)) | **OUI** — tout `authenticated` lit toute la matrice |
| `get_role_permission(...)` | Vérifie USE/MANAGE/GRANT/DELEGATE sur `rbac.role_permissions` + scope | Non contournable via RPC |

### Divergence

- `get_role_permission` ajoute une sécurité au niveau RPC
- Mais l'accès direct à la table `role_permissions` reste **totalement ouvert** à tout `authenticated`
- Un frontend malveillant ou un appel SQL direct peut lire toute la matrice RBAC

**Gravité : IMPORTANT** — Fuite d'information possible, bien que l'écriture soit protégée.

---

## 6. AUTRES CONSTATS

### Permission 'role' — Intention vs Réalité

L'utilisation de `'role'` comme `p_permission_id` suggère une confusion entre :
- **Rôle** (entité dans `public.roles`, assigné via `user_roles`)
- **Permission** (entité dans `public.permissions`, attachée aux rôles via `role_permissions`)

Le modèle n'a **jamais** prévu de permission `'role'`. Les rôles ne sont pas des permissions.

### Anti-escalade indirecte — Couverture incomplète

Même si on corrige la détection du rôle cible, il reste un chemin d'escalade possible :

```
Acteur (GRANT sur rbac.*, mais PAS GRANT sur users.change_role)
  → grant_role_permission(son_rôle, 'users.change_role', {"grant": true})
  → Vérification anti-escalade : acteur a-t-il GRANT sur users.change_role ? NON → BLOQUÉ ✅
```

→ **Ce chemin est bien protégé** par la vérification capability par capability (ligne 162-174 grant / ligne 321-337 revoke).

---

## 7. MATRICE DE GRAVITÉ

| # | Problème | Gravité | RPC concernées |
|---|---|---|---|
| 1 | `has_effective_capability(..., 'role', ...)` retourne toujours FALSE | **BLOQUANT** | grant_role_permission, revoke_role_permission |
| 2 | Protections anti-auto-élévation/révocation inactives | **BLOQUANT** | grant_role_permission, revoke_role_permission |
| 3 | RLS `role_permissions_select_all` = USING(true) | **IMPORTANT** | get_role_permission (contournable) |
| 4 | Pas de primitive « a le rôle X » incluant délégations | **IMPORTANT** | Les deux RPC |
| 5 | `scope_includes('role','X','user',uid)` ne couvre que rôles directs | **MINEUR** | Conception S1 |

---

## 8. RECOMMANDATIONS

### Correction requise (BLOQUANT)

Remplacer la détection « acteur a le rôle cible » par une méthode qui fonctionne :

**Option A — Requête directe unifiée (recommandée)**
```sql
-- Fonction helper à créer ou inline
v_actor_has_target_role := exists (
    -- 1. Rôle direct
    select 1 from public.user_roles ur
    where ur.user_id = v_actor_uid
      and ur.role_id = p_target_role_id
      and ur.revoked_at is null
      and (ur.expires_at is null or ur.expires_at > now())
    union
    -- 2. Rôle via délégation de rôle reçue (role_delegations)
    select 1 from public.user_roles ur
    join public.role_delegations rd on rd.target_role_id = ur.role_id
    where ur.user_id = v_actor_uid
      and ur.revoked_at is null
      and (ur.expires_at is null or ur.expires_at > now())
      and rd.revoked_at is null
      and (rd.expires_at is null or rd.expires_at > now())
      and rd.permission_id = p_target_role_id  -- ou logique selon sémantique délégation
    union
    -- 3. Rôle via délégation user reçue (user_delegations)
    select 1 from public.user_delegations ud
    where ud.grantee_user_id = v_actor_uid
      and ud.revoked_at is null
      and (ud.expires_at is null or ud.expires_at > now())
      -- selon sémantique : ud.permission_id liée au rôle ?
);
```

**Option B — Utiliser `get_effective_authority` et parser les rôles**
```sql
v_actor_has_target_role := exists (
    select 1 from public.get_effective_authority(v_actor_uid) gea
    where gea.source = 'role' 
      and gea.source_role_id = p_target_role_id
      and gea.capability = 'USE'  -- ou n'importe quelle cap prouve possession du rôle
);
```

**Option C — Créer une fonction dédiée `has_role_effective(uid, role_id)`**
- Réutilise la logique de `get_effective_authority` (CTE `active_roles` + chaînes délégation)
- Retourne TRUE si rôle possédé directement ou via délégation

### Correction RLS (IMPORTANT)

Soit :
1. **Restreindre** `role_permissions_select_all` à `has_effective_capability(auth.uid(), 'USE', 'rbac.role_permissions', ...)`
2. **Ou** documenter que la lecture directe est publique et que `get_role_permission` est pour l'API applicative seulement

### Tests à ajouter

| Test | Description |
|---|---|
| T-A | Acteur a rôle cible direct → anti-auto-élévation déclenchée |
| T-B | Acteur a rôle cible via délégation reçue → anti-auto-élévation déclenchée |
| T-C | Acteur n'a pas rôle cible → anti-auto-élévation PAS déclenchée |
| T-D | Lecture directe `role_permissions` par user sans autorité RBAC → données visibles (confirmation fuite) |

---

## CONCLUSION

**NO_GO_PHASE2**

La correction Phase 1 contient un **défaut logique majeur** : l'utilisation de `has_effective_capability(..., 'role', ...)` avec une permission inexistante rend **toutes les protections anti-auto-élévation et anti-auto-révocation inopérantes**.

De plus, la politique RLS `USING(true)` sur `role_permissions` permet à tout utilisateur authentifié de contourner `get_role_permission` en lecture directe.

**Actions requises avant Phase 2 :**
1. Corriger la détection de rôle effectif (créer `has_role_effective` ou requête unifiée)
2. Appliquer la correction aux 2 RPC
3. Décider et appliquer la correction RLS sur `role_permissions`
4. Tester les 4 scénarios critiques (T-A à T-D)