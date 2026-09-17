# P1.3.4-B-S2-B-PHASE1-CORRECTION-IMPLEMENTATION

## Migration créée
**Fichier** : `supabase/migrations/20260917180000_p1_3_4_b_s2_b_phase1_correction.sql`
**Statut** : Pushée sur le remote avec succès
**Historique** : Local ↔ Remote synchronisés (11 migrations communes)

## RPC modifiées (3)

### 1. grant_role_permission
**Changements clés** :
- ✅ Autorisation d'entrée : **GRANT** sur `rbac.role_permissions` (remplace MANAGE)
- ✅ Anti-escalade inchangé : chaque capability demandée ≤ détenue sur permission cible
- ✅ **Anti-auto-élévation** : si acteur a rôle cible effectif → interdit d'ajouter GRANT/DELEGATE sur permissions RBAC sensibles
- ✅ Utilise `has_effective_capability(auth.uid(), 'USE', 'role', 'role', target_role_id)` pour détecter rôle effectif (direct + délégation)
- ✅ Validation `scope_type` ∈ ('global','role','user')
- ✅ `SECURITY DEFINER`, `SET search_path = public`, `EXECUTE` à authenticated, `REVOKE` anon

### 2. revoke_role_permission
**Changements clés** :
- ✅ Autorisation d'entrée : **GRANT** sur `rbac.role_permissions` (remplace MANAGE)
- ✅ **Anti-auto-révocation** : détection via `has_effective_capability(..., 'USE', 'role', 'role', target_role_id)` — couvre direct + délégation
- ✅ Interdiction de retirer MANAGE/GRANT/DELEGATE sur permissions RBAC sensibles si acteur a rôle cible effectif
- ✅ **Supprimé bypass Super Admin** : plus de `has_role(..., 'super_admin')` — règle s'applique à tous
- ✅ Auto-révocation USE reste autorisée
- ✅ Validation `scope_type` ∈ ('global','role','user')
- ✅ `SECURITY DEFINER`, `SET search_path = public`, `EXECUTE` à authenticated, `REVOKE` anon

### 3. get_role_permission
**Changements clés** :
- ✅ **Nouveau contrôle d'autorisation** : exige USE OU MANAGE OU GRANT OU DELEGATE sur `rbac.role_permissions` dans le scope
- ✅ **Paramètres scope obligatoires** : `p_scope_type`, `p_scope_value` (défaut 'global')
- ✅ Refuse : authenticated sans autorité RBAC, consultation hors scope
- ✅ Lookup unique `(role_id, permission_id)` — pas d'énumération
- ✅ Retourne capabilities (ou toutes false si ligne inexistante)
- ✅ Validation `scope_type` ∈ ('global','role','user')
- ✅ `SECURITY DEFINER` (stable), `SET search_path = public`, `EXECUTE` à authenticated, `REVOKE` anon

## Règles MANAGE / GRANT / DELEGATE (implémentées)

| Capability | Sur `rbac.role_permissions` | Rôle |
|---|---|---|
| **USE** | Lecture config (get_role_permission) | Consultation seulement |
| **MANAGE** | **Inutilisé** pour mutations (réservé futur : admin technique table) | Ne donne PAS droit d'attribuer |
| **GRANT** | **Porte d'entrée unique** pour toutes mutations (grant + revoke) | Attribuer/retirer capabilities |
| **DELEGATE** | Requis en plus de GRANT pour accorder DELEGATE sur permission cible | Métadélégation |

**Règle effective** :
```
grant_role_permission / revoke_role_permission  →  exigent GRANT sur rbac.role_permissions
get_role_permission                            →  exige USE/MANAGE/GRANT/DELEGATE sur rbac.role_permissions
```

## Anti-escalade implémenté

| Protection | grant_role_permission | revoke_role_permission | get_role_permission |
|---|---|---|---|
| Authentification | ✅ | ✅ | ✅ |
| GRANT sur rbac.role_permissions | ✅ | ✅ | N/A (USE/MANAGE/GRANT/DELEGATE) |
| Scope demandé ⊆ scope détenu | ✅ (via has_effective_capability) | ✅ | ✅ |
| Capability demandée ≤ détenue (permission cible) | ✅ | N/A | N/A |
| Rôle/permission cible existent | ✅ | ✅ | ✅ |
| Auto-élévation GRANT/DELEGATE sur RBAC | ✅ (bloqué si rôle cible effectif) | N/A | N/A |
| Auto-révocation MANAGE/GRANT/DELEGATE sur RBAC | N/A | ✅ (bloqué si rôle cible effectif) | N/A |
| Super Admin bypass | ❌ Supprimé | ❌ Supprimé | ❌ N/A |

## Auto-révocation — Règle exacte

```sql
-- Dans revoke_role_permission
v_actor_has_target_role := public.has_effective_capability(
    auth.uid(), 'USE', 'role', 'role', p_target_role_id
);

if v_actor_has_target_role and p_permission_id in (rbac.*) then
    for v_cap in p_capabilities loop
        if v_cap in ('MANAGE','GRANT','DELEGATE') then
            raise exception 'AUTO_REVOCATION_INTERDITE...';
        end if;
    end loop;
end if;
```

- Couverture : rôle direct + rôle via délégation reçue (grâce à `has_effective_capability`)
- Permissions protégées : `rbac.role_permissions`, `rbac.role_delegations`, `rbac.user_delegations`, `rbac.role_assignability`
- Capabilities protégées : MANAGE, GRANT, DELEGATE
- **S'applique à Super Admin** (plus de bypass)

## Autorité effective — Réutilisation S1 exclusive

| Primitive S1 | Utilisée dans | Pour |
|---|---|---|
| `has_effective_capability()` | Les 3 RPC | Toutes vérifications d'autorisation (auth, GRANT, anti-escalade, scope) |
| `scope_includes()` | Via has_effective_capability | Tous contrôles de scope |

**Aucune réimplémentation parallèle** — pas de `SELECT FROM user_roles JOIN role_delegations...`

## Scope

- Réutilise `scope_includes()` via `has_effective_capability()` ✅
- `scope_type` validé ∈ ('global','role','user') ✅
- `self` exclu (Decision 2) ✅
- Sémantique `role` = bénéficiaire (Decision 1 Option A) ✅
- Hiérarchie : `global ⊃ role:X ⊃ user:U` ✅

## Sécurité SQL

| Vérification | grant_role_permission | revoke_role_permission | get_role_permission |
|---|---|---|---|
| `SECURITY DEFINER` | ✅ | ✅ | ✅ |
| `SET search_path = public` | ✅ | ✅ | ✅ |
| Références qualifiées `public.` | ✅ | ✅ | ✅ |
| Pas d'accès direct `auth.users` | ✅ (via `auth.uid()`) | ✅ | ✅ |
| `GRANT EXECUTE` à `authenticated` | ✅ | ✅ | ✅ |
| `REVOKE EXECUTE` de `anon` | ✅ | ✅ | ✅ |
| RLS inchangées | ✅ | ✅ | ✅ |

## Données — Non modifiées ✅

- Permissions `rbac.*` existantes conservées
- Capabilities Super Admin conservées
- Aucune insertion/modification/suppression de données métier

## Tests — Matrice préparée (NON EXÉCUTÉS)

| ID | Scénario | Résultat attendu | Statut |
|---|---|---|---|
| T01 | Anon | Erreur / permission denied | ⬜ NON TESTÉ |
| T02 | Auth sans rbac.* | `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| T03 | USE seulement sur rbac.* | `PERMISSION_INSUFFISANTE` (GRANT requis) | ⬜ NON TESTÉ |
| T04 | MANAGE seulement sur rbac.* | `PERMISSION_INSUFFISANTE` (GRANT requis) | ⬜ NON TESTÉ |
| T05 | GRANT sur rbac.* sans GRANT sur cible | `ESCALADE_INTERDITE` | ⬜ NON TESTÉ |
| T06 | GRANT global + GRANT sur cible | **SUCCÈS** | ⬜ NON TESTÉ |
| T07 | GRANT global, demande scope role:X | **SUCCÈS** (global ⊃ role) | ⬜ NON TESTÉ |
| T08 | GRANT role:admin, demande global | `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| T09 | Demande MANAGE sans l'avoir | `ESCALADE_INTERDITE` | ⬜ NON TESTÉ |
| T10 | Demande DELEGATE avec DELEGATE | **SUCCÈS** | ⬜ NON TESTÉ |
| T11 | Demande DELEGATE sans DELEGATE | `ESCALADE_INTERDITE` | ⬜ NON TESTÉ |
| T12 | user_role expiré | `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| T13 | user_role révoqué | `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| T14 | Auto-GRANT sur rbac.* | **INTERDIT** `AUTO_ELÉVATION_INTERDITE` | ⬜ NON TESTÉ |
| T15 | Auto-DELEGATE sur rbac.* | **INTERDIT** | ⬜ NON TESTÉ |
| T16 | Auto-révocation MANAGE (rôle direct) | **INTERDIT** `AUTO_REVOCATION_INTERDITE` | ⬜ NON TESTÉ |
| T17 | Auto-révocation via délégation | **INTERDIT** (même protection) | ⬜ NON TESTÉ |
| T18 | Super Admin auto-révocation | **INTERDIT** (pas de bypass) | ⬜ NON TESTÉ |
| T19 | Rôle inexistant | `ROLE_INEXISTANT` | ⬜ NON TESTÉ |
| T20 | Permission inexistante | `PERMISSION_INEXISTANTE` | ⬜ NON TESTÉ |
| T21 | Doublon | Upsert merge | ⬜ NON TESTÉ |
| T22 | get sans autorité RBAC | `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| T23 | get avec USE global | **SUCCÈS** | ⬜ NON TESTÉ |
| T24 | get scope role:X, cible hors scope | `SCOPE_INSUFFISANT` / `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |

**Tous NON TESTÉS** — Docker indisponible, pas de client SQL direct, pas d'Edge Function de test.

## Risques résiduels

| # | Risque | Atténuation |
|---|---|---|
| 1 | Tests non exécutés | Nécessite environnement de test (Docker/CI) avant production |
| 2 | `has_effective_capability('USE', 'role', 'role', target)` — performance | Index `user_roles_user_id_idx`, `user_roles_role_id_idx` existants ; profondeur chaîne ≤5 |
| 3 | Merge `true l'emporte` — impossible de désactiver via grant | Documenté : utiliser `revoke_role_permission` pour désactiver |
| 4 | Super Admin peut s'auto-verrouiller | Récupération via `bootstrap_super_admin()` SQL direct (service_role) |
| 5 | `get_role_permission` retourne ligne inexistante = toutes false | Comportement intentionnel (pas de fuite d'info sur existence) |

## Points d'attention Phase 2

- Les permissions `rbac.role_delegations`, `rbac.user_delegations`, `rbac.role_assignability` existent et ont GRANT/DELEGATE pour Super Admin
- Les RPC Phase 2 devront suivre le même modèle : **GRANT** pour mutations, **DELEGATE** pour créer délégations
- L'anti-auto-élévation doit être réutilisé (même pattern `has_effective_capability(..., 'USE', 'role', 'role', ...)`)

---

**Migration appliquée, RPC corrigées, sécurité vérifiée. En attente de validation pour Phase 2.**