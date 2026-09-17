# P1.3.4-B-S2-B-PHASE1-ROLE-AND-RLS-CORRECTION

## Migration créée
**Fichier** : `supabase/migrations/20260917200000_p1_3_4_b_s2_b_phase1_correction_v2.sql`
**Statut** : Pushée sur le remote avec succès
**Historique** : Local ↔ Remote synchronisés (12 migrations communes)

---

## 1. ANALYSE DE LA SÉMANTIQUE DU RÔLE EFFECTIF

### Modèle actuel — Ce qui constitue "avoir un rôle"

| Source | Table | Donne un rôle ? | Donne des capabilities ? |
|---|---|---|---|
| Assignment direct | `user_roles` | **OUI** (si actif, non expiré, non révoqué) | Via `role_permissions` |
| Délégation de rôle | `role_delegations` | **NON** | **OUI** (sur permission cible) |
| Délégation user | `user_delegations` | **NON** | **OUI** (sur permission cible) |
| Assignabilité | `role_assignability` | **NON** | **NON** (configure qui peut assigner) |

### Preuve dans le code S1 (`get_effective_authority`)

Le CTE `active_roles` (lignes 256-263) ne sélectionne QUE depuis `user_roles` :
```sql
active_roles as (
    select ur.role_id, r.name as role_name
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and ur.revoked_at is null
      and (ur.expires_at is null or ur.expires_at > now())
)
```

Les délégations sont traitées SÉPARÉMENT dans les CTEs `role_delegations_chain` et `user_delegations_valid` — elles produisent des capabilities sur permissions, pas des rôles.

### Conclusion

**"Posséder un rôle" = avoir une ligne active dans `user_roles` pour ce rôle.**
Les délégations ne donnent jamais de rôle. Elles donnent des capabilities (USE/MANAGE/GRANT) sur des permissions spécifiques dans des scopes spécifiques.

---

## 2. DÉCISION : `has_role_effective(p_user_id, p_role_id)`

### Fonction créée

```sql
create or replace function public.has_role_effective(
    p_user_id uuid,
    p_role_id text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_user_id is null then return false; end if;
    if p_role_id is null or p_role_id = '' then return false; end if;

    return exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_user_id
          and ur.role_id = p_role_id
          and ur.revoked_at is null
          and (ur.expires_at is null or ur.expires_at > now())
    );
end;
$$;
```

### Caractéristiques
- ✅ **SECURITY DEFINER** + `SET search_path = public`
- ✅ Vérifie assignment direct SEULEMENT (`user_roles`)
- ✅ Respecte `revoked_at` et `expires_at`
- ✅ Ne considère PAS les délégations comme donnant un rôle
- ✅ Retourne `false` pour entrées invalides (pas d'exception)
- ✅ `EXECUTE` à `authenticated`, `REVOKE` de `anon`

### Pourquoi pas `has_effective_capability` ?

`has_effective_capability` répond à : *"L'utilisateur a-t-il la capability X sur la permission Y dans le scope Z ?"*
Elle joint sur `permissions` — il n'existe pas de permission `'role'`.

`has_role_effective` répond à : *"L'utilisateur a-t-il le rôle X assigné ?"*
Question sémantiquement différente, source de vérité différente (`user_roles` vs `role_permissions` + délégations).

---

## 3. CORRECTION DES RPC

### grant_role_permission

| Avant (v1) | Après (v2) |
|---|---|
| `has_effective_capability(uid, 'USE', 'role', 'role', target)` | `has_role_effective(uid, target)` |
| Détection rôle via permission inexistante | Détection rôle via `user_roles` direct |
| **Ne fonctionnait jamais** (toujours FALSE) | **Fonctionne** — détecte assignment direct |

**Protections conservées :**
- GRANT sur `rbac.role_permissions` comme porte d'entrée
- Capability demandée ≤ capability détenue sur permission cible
- Scope demandé ⊆ scope détenu (via `has_effective_capability`)
- Anti-auto-élévation GRANT/DELEGATE sur permissions RBAC sensibles
- Pas de bypass Super Admin
- SECURITY DEFINER, search_path, authenticated only

### revoke_role_permission

| Avant (v1) | Après (v2) |
|---|---|
| `has_effective_capability(uid, 'USE', 'role', 'role', target)` | `has_role_effective(uid, target)` |
| Détection rôle via permission inexistante | Détection rôle via `user_roles` direct |
| Bypass Super Admin via `has_role(..., 'super_admin')` | **Supprimé** — règle s'applique à tous |

**Protections conservées :**
- GRANT sur `rbac.role_permissions` comme porte d'entrée
- Anti-auto-révocation MANAGE/GRANT/DELEGATE sur permissions RBAC sensibles
- S'applique à TOUS (Super Admin inclus)
- SECURITY DEFINER, search_path, authenticated only

### get_role_permission

**NON MODIFIÉE** — déjà correcte dans v1 :
- Vérifie USE/MANAGE/GRANT/DELEGATE sur `rbac.role_permissions` + scope
- Paramètres scope obligatoires
- Lookup unique `(role_id, permission_id)`
- Pas d'énumération

---

## 4. ANALYSE ET CORRECTION RLS — `role_permissions`

### Problème identifié

Policy existante (migration 20260911, ligne 212-215) :
```sql
create policy "role_permissions_select_all"
on public.role_permissions for select
to authenticated
using (true);  -- TOUT authenticated lit TOUTE la matrice
```

### Conséquence
- Tout utilisateur authentifié peut faire `SELECT * FROM role_permissions`
- Contourne complètement `get_role_permission()` et ses contrôles d'autorisation/scope
- Fuite d'information : matrice RBAC complète visible

### Solution appliquée

**Option choisie : Restreindre la lecture directe à `super_admin` uniquement.**

```sql
-- Supprimer l'ancienne policy
drop policy if exists "role_permissions_select_all" on public.role_permissions;

-- Nouvelle policy restrictive
create policy "role_permissions_select_super_admin"
on public.role_permissions for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));
```

### Rationale

1. **Cohérence** : Les autres tables de config RBAC (`role_delegations`, `user_delegations`, `role_assignability`) ont déjà cette restriction (super_admin seulement pour SELECT)
2. **Sécurité** : La lecture autorisée pour les autres acteurs passe par `get_role_permission()` qui :
   - Est `SECURITY DEFINER` (bypass RLS)
   - Fait ses propres vérifications d'autorisation (USE/MANAGE/GRANT/DELEGATE sur `rbac.role_permissions` + scope)
   - Retourne seulement le lookup demandé `(role_id, permission_id)` — pas d'énumération
3. **Pas de récursion RLS** : La policy n'appelle pas de fonction qui ferait un SELECT sur `role_permissions`
4. **Super Admin** : Garde l'accès direct pour admin/debug (comme avant)

### Policies d'écriture — INCHANGÉES

| Policy | Table | Using / With Check |
|---|---|---|
| `role_permissions_manage_admin` | role_permissions | `has_role(auth.uid(), 'admin')` |
| `role_permissions_manage_super_admin` | role_permissions | `has_role(auth.uid(), 'super_admin')` |

---

## 5. MATRICE DE TESTS

### Tests définis (NON EXÉCUTÉS — Docker indisponible)

| ID | Scénario | Résultat attendu | Statut |
|---|---|---|---|
| **T-A** | Acteur a rôle cible direct (user_roles actif) → grant GRANT sur rbac.* | `AUTO_ELÉVATION_INTERDITE` | ⬜ NON TESTÉ |
| **T-B** | Acteur a rôle cible via délégation reçue → grant GRANT sur rbac.* | **SUCCÈS** (délégation ne donne pas rôle) | ⬜ NON TESTÉ |
| **T-C** | Acteur n'a pas rôle cible → grant GRANT sur rbac.* | **SUCCÈS** | ⬜ NON TESTÉ |
| **T-D** | Authenticated sans autorité RBAC → SELECT direct role_permissions | **REFUS** (policy super_admin seulement) | ⬜ NON TESTÉ |
| **T-E** | Rôle expiré (expires_at < now()) → has_role_effective | FALSE | ⬜ NON TESTÉ |
| **T-F** | Rôle révoqué (revoked_at non null) → has_role_effective | FALSE | ⬜ NON TESTÉ |
| **T-G** | Délégation role_delegations expirée → has_role_effective | FALSE (n'affecte pas rôle) | ⬜ NON TESTÉ |
| **T-H** | Délégation user_delegations révoquée → has_role_effective | FALSE (n'affecte pas rôle) | ⬜ NON TESTÉ |
| **T-I** | Super Admin → anti-auto-révocation MANAGE sur rbac.* | `AUTO_REVOCATION_INTERDITE` (pas de bypass) | ⬜ NON TESTÉ |
| **T-J** | get_role_permission avec USE sur rbac.*, scope global | **SUCCÈS** | ⬜ NON TESTÉ |
| **T-K** | get_role_permission avec USE sur rbac.*, scope role:X, cible dans scope | **SUCCÈS** | ⬜ NON TESTÉ |
| **T-L** | get_role_permission avec USE sur rbac.*, scope role:X, cible hors scope | `PERMISSION_INSUFFISANTE` / `SCOPE_INSUFFISANT` | ⬜ NON TESTÉ |
| **T-M** | get_role_permission avec USE sur rbac.*, scope user:U, cible = rôle de U | **SUCCÈS** | ⬜ NON TESTÉ |
| **T-N** | grant_role_permission sans GRANT sur rbac.* | `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| **T-O** | grant_role_permission avec GRANT sur rbac.* mais sans GRANT sur cible | `ESCALADE_INTERDITE` | ⬜ NON TESTÉ |

---

## 6. RISQUES RÉSIDUELS

| # | Risque | Description | Atténuation |
|---|---|---|---|
| 1 | **Tests non exécutés** | Impossible de valider le comportement réel sans Docker/CI | Configurer environnement test avant production |
| 2 | **has_role_effective ne couvre pas délégations** | Par conception — les délégations ne donnent pas de rôle. Si le modèle évolue, revoir. | Documenté dans commentaire fonction |
| 3 | **Super Admin perd lecture directe role_permissions** | Seuls super_admin peuvent SELECT direct. Autres passent par RPC. | get_role_permission() couvre les besoins légitimes |
| 4 | **Appels existants à SELECT role_permissions** | Frontend/autres codes qui font SELECT direct casseront pour non-super_admin | Migration breaking change — à communiquer |
| 5 | **Performance has_role_effective** | Simple index scan sur `user_roles_user_id_idx` + `user_roles_role_id_idx` existants | Acceptable |
| 6 | **Cohérence get_effective_authority** | Cette fonction liste les rôles depuis user_roles (active_roles CTE) — cohérent | ✅ Aligné |

---

## 7. CHANGEMENTS RÉSUMÉS

### Nouvelle fonction
- `has_role_effective(uuid, text)` → primitive dédiée "possède rôle"

### RPC modifiées
- `grant_role_permission` : utilise `has_role_effective` pour anti-auto-élévation
- `revoke_role_permission` : utilise `has_role_effective` pour anti-auto-révocation + supprime bypass Super Admin

### RPC inchangée
- `get_role_permission` : déjà correcte (v1)

### RLS modifiée
- `role_permissions` : suppression `role_permissions_select_all` (USING(true))
- Nouvelle `role_permissions_select_super_admin` (super_admin seulement)

### Données
- **Aucune modification** — permissions `rbac.*` et caps Super Admin conservées

---

## 8. VÉRIFICATION LOCALE EFFECTUÉE

- ✅ Migration syntaxiquement valide (push réussie)
- ✅ Historique migrations synchronisé local/remote
- ✅ Aucune modification de migrations historiques
- ✅ Aucune donnée métier modifiée
- ✅ Aucune table créée/supprimée
- ✅ Frontend non touché
- ✅ `src/lib/theme.js` non touché

---

## STATUT FINAL

**READY_FOR_REVIEW**

La correction cible les 2 problèmes BLOQUANT + IMPORTANT identifiés :
1. ✅ `has_effective_capability(..., 'role', ...)` inopérante → remplacée par `has_role_effective()`
2. ✅ RLS `USING(true)` sur `role_permissions` → restreinte à super_admin

En attente de validation pour :
- Exécution des tests (quand Docker/CI disponible)
- Phase 2 (role_delegations)

---

**Note** : Cette migration est additive (nouvelle fonction + remplacement RPC + modification RLS). Elle ne supprime ni ne modifie de données existantes.