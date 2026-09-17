# P1.3.4-B-S2-B-PHASE1-AUDIT

## VERDICT : **NO-GO** pour Phase 2

**Raisons principales :**
1. **Confusion MANAGE vs GRANT** : La RPC `grant_role_permission` utilise MANAGE sur `rbac.role_permissions` pour *toutes* les opérations (ajout, modification, suppression implicite via merge). GRANT n'est jamais vérifié.
2. **Anti-escalade incomplète** : Protection auto-révocation ne couvre que le rôle direct, pas les délégations reçues.
3. **`get_role_permission` sans contrôle d'autorisation** : Lecture ouverte à tout `authenticated` sans vérification de scope/authority.
4. **Scope `role` non validé** : La sémantique Decision 1 (Option A) n'est pas testée ni documentée dans le code.
5. **Super Admin bypass** : `has_role(auth.uid(), 'super_admin')` utilisé comme bypass générique dans `revoke_role_permission`.

---

## 1. SÉPARATION DES CAPABILITIES — ⚠️ PARTIEL

### Code analysé
```sql
-- grant_role_permission : ligne 147-157
v_actor_has_authority := public.has_effective_capability(
    v_actor_uid, 'MANAGE', 'rbac.role_permissions', p_scope_type, p_scope_value
);

-- Anti-escalade ligne 162-174 : vérifie CHAQUE capability demandée sur permission CIBLE
for v_cap in select key from jsonb_object_keys(p_capabilities) where value = 'true'
loop
    if not public.has_effective_capability(v_actor_uid, upper(v_cap), p_permission_id, p_scope_type, p_scope_value)
    then raise exception 'ESCALADE_INTERDITE...'
end loop;
```

### Constat
| Capability | Utilisée pour | Vérifiée sur |
|---|---|---|
| **MANAGE** | Autorisation d'exécuter la RPC (sur `rbac.role_permissions`) | ✅ Oui |
| **GRANT** | **Jamais vérifiée** pour les opérations d'écriture | ❌ Non |
| **DELEGATE** | Jamais vérifiée | ❌ Non |
| **USE** | Vérifiée seulement si demandée dans `p_capabilities` (anti-escalade) | ✅ Partiel |

### Problème critique
- **GRANT n'autorise rien** dans le code actuel
- **MANAGE fait office de "tout pouvoir" sur la config RBAC**
- Cela contredit le modèle : `GRANT` devrait autoriser *l'attribution* de permissions à d'autres rôles

### Règle effective actuelle (non documentée, implicite)
```
MANAGE sur rbac.role_permissions  →  Peut TOUT faire (créer, modifier, supprimer via merge)
GRANT sur rbac.role_permissions   →  Inutilisé
DELEGATE sur rbac.role_permissions →  Inutilisé
USE sur rbac.role_permissions      →  Inutilisé (sauf get_role_permission qui n'en tient pas compte)
```

---

## 2. GRANT — ❌ NON RESPECTÉ

### Opérations et capability requise (code actuel)

| Opération | Capability requise (code) | Capability attendue (modèle) |
|---|---|---|
| Ajouter permission à un rôle | MANAGE sur `rbac.role_permissions` | GRANT sur `rbac.role_permissions` |
| Modifier capabilities existantes | MANAGE sur `rbac.role_permissions` | GRANT ou MANAGE selon sémantique |
| Retirer permission (via revoke_role_permission) | MANAGE sur `rbac.role_permissions` | GRANT ou MANAGE |

### Analyse
- **Une seule capability (MANAGE) contrôle toutes les mutations**
- **GRANT est ignoré** — pourtant le modèle S1/S2-A prévoit GRANT = "attribuer à d'autres"
- **Conflit** : Si un acteur a MANAGE mais pas GRANT sur `rbac.role_permissions`, il peut quand même attribuer GRANT à d'autres → **escalade possible**

---

## 3. ANTI-ESCALADE — ⚠️ PARTIEL / FAILLE CONFIRMÉE

### Protections présentes ✅
| Protection | grant_role_permission | revoke_role_permission |
|---|---|---|
| Capability demandée ≤ capability détenue (sur permission cible) | ✅ Ligne 162-174 | N/A (révocation) |
| Scope demandé ⊆ scope détenu | ✅ Via `has_effective_capability` | ✅ Via `has_effective_capability` |
| Rôle/permission cible existent | ✅ | ✅ |
| Auto-révocation MANAGE/GRANT/DELEGATE sur `rbac.role_permissions` | N/A | ✅ Ligne 329-337 (si rôle direct) |

### Failles identifiées ❌

#### Faille 1 : Auto-révocation via délégation non couverte
```sql
-- Ligne 298-304 : ne vérifie QUE user_roles direct
select exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_actor_uid
      and ur.role_id = p_target_role_id
      and ur.revoked_at is null
      and (ur.expires_at is null or ur.expires_at > now())
) into v_is_self_revocation;
```
**Problème** : Si l'acteur a le rôle cible via **délégation reçue** (role_delegations/user_delegations), `v_is_self_revocation = false` → protection bypassée.

#### Faille 2 : Auto-GRANT possible
Un acteur avec MANAGE sur `rbac.role_permissions` peut s'attribuer GRANT/DELEGATE sur n'importe quelle permission (y compris `rbac.role_permissions` lui-même) via `grant_role_permission` sur son propre rôle.
- La vérification ligne 162-174 porte sur la **permission cible** (`p_permission_id`), pas sur `rbac.role_permissions`
- Si l'acteur a MANAGE sur `rbac.role_permissions` + GRANT sur `users.change_role` (scope global), il peut faire `grant_role_permission(super_admin, 'rbac.role_permissions', {"grant": true}, 'global')` → **s'auto-accorde GRANT sur la config RBAC**

#### Faille 3 : Élargissement de scope via permission cible
L'acteur a MANAGE sur `rbac.role_permissions` en scope `role:admin`.
Il appelle `grant_role_permission(target_role, 'users.manage', {"grant": true}, 'global')`.
- Vérification ligne 147-153 : MANAGE sur `rbac.role_permissions` en scope `role:admin` → **ÉCHOUERA** car `has_effective_capability` vérifie scope_includes
- MAIS si l'acteur a MANAGE sur `rbac.role_permissions` en scope `global`, il peut écrire en `global` sur n'importe quelle permission → **comportement correct mais puissant**

#### Faille 4 : Création DELEGATE sans DELEGATE
Ligne 162-174 vérifie que l'acteur a la capability demandée. Si l'acteur demande `"delegate": true`, il faut qu'il ait DELEGATE sur la permission cible. **C'est correct.**
MAIS : il peut créer DELEGATE sur `rbac.role_delegations` s'il a DELEGATE sur `rbac.role_delegations` → circulaire si on n'y prend garde.

---

## 4. AUTO-MODIFICATION — ⚠️ PARTIEL

### grant_role_permission
| Scénario | Résultat | Note |
|---|---|---|
| Acteur ajoute capability à son propre rôle | **AUTORISÉ** | Pas de blocage |
| Acteur s'ajoute GRANT/DELEGATE sur `rbac.role_permissions` | **AUTORISÉ** si il a déjà ces caps sur permission cible | Faille escalade |
| Super Admin | **AUTORISÉ** | Normal |

### revoke_role_permission
| Scénario | Résultat | Note |
|---|---|---|
| Acteur retire capability de son propre rôle (USE) | **AUTORISÉ** | |
| Acteur retire MANAGE/GRANT/DELEGATE de son propre rôle sur `rbac.role_permissions` | **INTERDIT** (ligne 329-337) | Sauf super_admin |
| Acteur retire capability via délégation reçue | **AUTORISÉ** (protection bypassée) | Faille 1 |
| Super Admin | **AUTORISÉ** (bypass ligne 307) | Exception documentée |

### Exception Super Admin — Documentée exactement
```sql
-- Ligne 306-307
select public.has_role(v_actor_uid, 'super_admin') into v_is_super_admin;
...
if v_is_self_revocation and not v_is_super_admin then
```
- **Seule exception** : `has_role(auth.uid(), 'super_admin')` = true
- **Pas de bypass** sur les autres vérifications (auth, MANAGE, scope, capability demandée ≤ détenue)
- **Risque** : super_admin peut se révoquer ses propres capacités MANAGE/GRANT/DELEGATE sur `rbac.role_permissions` → se verrouiller hors du système (sauf bootstrap SQL direct)

---

## 5. SCOPE — ✅ RÉUTILISATION CORRECTE MAIS NON TESTÉE

### Utilisation de `scope_includes`
- `has_effective_capability()` appelle `scope_includes()` internement (S1 validé)
- Les deux RPC passent `p_scope_type`, `p_scope_value` à `has_effective_capability`
- **Aucune logique parallèle** de comparaison de scope réimplémentée

### Relations supportées (via S1)
| Scope A | Scope B | Inclus ? |
|---|---|---|
| global | * | ✅ Oui |
| role:X | user:U (si U a rôle X) | ✅ Oui |
| role:X | role:Y | ❌ Non (sauf X=Y) |
| user:U | self | ❌ Non |
| self | * | ❌ Non |

### Point d'attention : Decision 1 (Option A)
- `scope_type='role'` avec `scope_value='manager'` = "tous users ayant rôle manager"
- **Non testé** : aucun jeu de données avec délégations scope role existant
- **Risque** : Si un acteur a MANAGE sur `rbac.role_permissions` en scope `role:admin`, peut-il gérer un rôle `manager` ? Dépend de `scope_includes('role','admin', 'role','manager')` → FALSE actuellement. **Comportement correct mais non validé.**

---

## 6. EXPIRATION / RÉVOCATION — ✅ COUVERT PAR S1

### `has_effective_capability()` (S1) filtre :
```sql
-- user_roles
ur.revoked_at is null and (ur.expires_at is null or ur.expires_at > now())

-- role_delegations
rd.revoked_at is null and (rd.expires_at is null or rd.expires_at > now())

-- user_delegations
ud.revoked_at is null and (ud.expires_at is null or ud.expires_at > now())
```

### RPC Phase 1
- N'utilisent que `has_effective_capability()` pour vérifier l'autorité
- **Ne contournent pas** ces contrôles
- **Correct** : autorité expirée/révoquée = pas d'accès

---

## 7. ACTEUR — ✅ CORRECT

### Toutes les RPC
```sql
v_actor_uid uuid := auth.uid();  -- Ligne 94, 240, etc.
```
- **Aucun paramètre `p_actor_uid` ou `p_user_id`**
- `auth.uid()` seule source d'identité
- **Frontend ne peut pas choisir l'acteur**

---

## 8. GET_ROLE_PERMISSION — ❌ PROBLÈME MAJEUR

### Code actuel
```sql
create or replace function public.get_role_permission(
    p_role_id text,
    p_permission_id text
) returns jsonb
language sql
stable
set search_path = public
as $$
    select jsonb_build_object(...)
    from public.role_permissions rp
    where rp.role_id = p_role_id
      and rp.permission_id = p_permission_id;
$$;
```

### Problèmes
| Problème | Gravité |
|---|---|
| **Aucun contrôle d'autorisation** | 🔴 Critique |
| Tout `authenticated` peut lire n'importe quel rôle/permission | 🔴 |
| Pas de vérification de scope | 🔴 |
| Information leakage : énumération complète de la matrice RBAC possible | 🟠 |
| `SECURITY DEFINER` + `stable` mais sans `auth.uid()` check | 🟠 |

### Comparaison RLS existante
```sql
-- Migration 20260911_p1_2_profiles_rbac.sql ligne 212-215
create policy "role_permissions_select_all"
on public.role_permissions for select
to authenticated
using (true);
```
- La table `role_permissions` a **déjà** une policy `USING(true)` pour `authenticated`
- `get_role_permission` **duplique** cette lecture sans ajouter de sécurité
- **Raison d'être** de la RPC ? Aucune valeur ajoutée sécuritaire

### Recommandation
- Soit **supprimer** `get_role_permission` (lecture directe via RLS suffisante)
- Soit **ajouter** contrôle : `has_effective_capability(auth.uid(), 'USE', 'rbac.role_permissions', ...)`

---

## 9. SECURITY DEFINER — ✅ CORRECT

| Vérification | grant_role_permission | revoke_role_permission | get_role_permission |
|---|---|---|---|
| `SECURITY DEFINER` | ✅ Ligne 90 | ✅ Ligne 236 | ✅ Ligne 383 |
| `SET search_path = public` | ✅ Ligne 91 | ✅ Ligne 237 | ✅ Ligne 384 |
| Références qualifiées (`public.`) | ✅ | ✅ | ✅ |
| Pas d'accès direct `auth.users` | ✅ (via `auth.uid()` seulement) | ✅ | ✅ |
| Pas de contournement RLS involontaire | ✅ (écriture via SECURITY DEFINER owner) | ✅ | ✅ (lecture) |

---

## 10. GRANTS — ✅ CORRECT

| Fonction | GRANT authenticated | REVOKE anon | REVOKE public |
|---|---|---|---|
| `grant_role_permission` | ✅ Ligne 217 | ✅ Ligne 218 | Implicite via REVOKE anon |
| `revoke_role_permission` | ✅ Ligne 369 | ✅ Ligne 370 | Implicite |
| `get_role_permission` | ✅ Ligne 402 | ✅ Ligne 403 | Implicite |

- **Anon ne peut exécuter aucune RPC**
- **Authenticated peut exécuter** (contrôle interne dans la fonction)
- **Public** : révoqué via `REVOKE ... FROM anon` (public hérite d'anon)

---

## 11. RLS — ✅ INCHANGÉES

### Policies existantes sur `role_permissions` (migration 20260911_p1_2_profiles_rbac.sql)
```sql
create policy "role_permissions_select_all"
on public.role_permissions for select
to authenticated using (true);

create policy "role_permissions_manage_admin"
on public.role_permissions for all
to authenticated using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "role_permissions_manage_super_admin"
on public.role_permissions for all
to authenticated using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));
```

### Audit
- **Aucune policy modifiée, supprimée ou affaiblie**
- **Aucun `USING(true)` ajouté sur écriture**
- Les RPC `SECURITY DEFINER` s'exécutent en tant que propriétaire (postgres) → **bypassent RLS pour l'écriture** (intentionnel, contrôlé par logique RPC)
- Lecture via `get_role_permission` aussi SECURITY DEFINER → bypass RLS mais pas de contrôle → **problème (voir §8)**

---

## 12. MIGRATION REMOTE — ✅ CORRESPONDANCE CONFIRMÉE

### Historique migrations (supabase migration list)
```
local: 20260917140000  ↔  remote: 20260917140000  ✅
```

### Contenu migration remote
- Identique au fichier local (push réussi sans erreur)
- 4 permissions `rbac.*` insérées
- 4 lignes `role_permissions` pour super_admin insérées/mises à jour
- 3 fonctions créées/remplacées

---

## 13. MATRICE DE TESTS PRÉPARÉE (NON EXÉCUTÉS)

| ID | Scénario | RPC | Résultat attendu | Statut |
|---|---|---|---|---|
| A | Unauthenticated (anon) | grant/revoke/get | Erreur `NON_AUTHENTIFIE` / permission denied | ⬜ NON TESTÉ |
| B | Authenticated sans rôle | grant/revoke | Erreur `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| C | Authenticated avec USE seulement sur rbac.role_permissions | grant/revoke | Erreur `PERMISSION_INSUFFISANTE` (MANAGE requis) | ⬜ NON TESTÉ |
| D | Authenticated avec MANAGE sur rbac.role_permissions mais sans GRANT | grant | **SUCCÈS ACTUEL** (bug : GRANT devrait être requis) | ⬜ NON TESTÉ |
| E | Authenticated avec MANAGE mais sans DELEGATE, demande DELEGATE | grant | Erreur `ESCALADE_INTERDITE` | ⬜ NON TESTÉ |
| F | Scope demandé > scope détenu (ex: global demandé, role:admin détenu) | grant/revoke | Erreur `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| G | Scope valide (global détenu, role demandé) | grant/revoke | Succès | ⬜ NON TESTÉ |
| H | Capability demandée = capability détenue | grant | Succès | ⬜ NON TESTÉ |
| I | Capability demandée > capability détenue (ex: demande GRANT, a USE) | grant | Erreur `ESCALADE_INTERDITE` | ⬜ NON TESTÉ |
| J | user_role expiré (expires_at < now()) | grant/revoke | Erreur `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| K | user_role révoqué (revoked_at non null) | grant/revoke | Erreur `PERMISSION_INSUFFISANTE` | ⬜ NON TESTÉ |
| L | Auto-GRANT : acteur s'ajoute GRANT sur rbac.role_permissions | grant | **ACTUELLEMENT AUTORISÉ** (faille) | ⬜ NON TESTÉ |
| M | Auto-révocation MANAGE sur rbac.role_permissions (rôle direct) | revoke | Erreur `AUTO_REVOCATION_INTERDITE` | ⬜ NON TESTÉ |
| N | Auto-révocation via délégation reçue | revoke | **ACTUELLEMENT AUTORISÉ** (faille) | ⬜ NON TESTÉ |
| O | Rôle inexistant | grant/revoke | Erreur `ROLE_INEXISTANT` | ⬜ NON TESTÉ |
| P | Permission inexistante | grant/revoke | Erreur `PERMISSION_INEXISTANTE` | ⬜ NON TESTÉ |
| Q | Doublon (permission existe déjà) | grant | Upsert (merge true l'emporte) | ⬜ NON TESTÉ |
| R | get_role_permission rôle autorisé (dans scope) | get | Retourne capabilities | ⬜ NON TESTÉ |
| S | get_role_permission rôle hors autorité (scope insuffisant) | get | **ACTUELLEMENT RETOURNE DONNÉES** (faille) | ⬜ NON TESTÉ |

---

## 14. RISQUES ET POINTS À CORRIGER AVANT PHASE 2

### 🔴 Critiques (bloquants Phase 2)

| # | Risque | Correction requise |
|---|---|---|
| 1 | **GRANT inutilisé** — MANAGE fait tout | Décider sémantique : GRANT = attribution, MANAGE = config. Modifier RPC pour vérifier GRANT sur permission cible. |
| 2 | **Auto-GRANT possible** — acteur s'ajoute GRANT/DELEGATE | Dans `grant_role_permission` : si `p_target_role_id` ∈ rôles_acteur, interdire d'ajouter GRANT/DELEGATE sauf super_admin. |
| 3 | **get_role_permission sans authz** | Supprimer OU ajouter vérification `has_effective_capability(auth.uid(), 'USE', 'rbac.role_permissions', ...)`. |
| 4 | **Auto-révocation via délégation bypassée** | Utiliser `has_effective_capability` pour détecter si acteur a le rôle cible (pas seulement user_roles direct). |

### 🟠 Majeurs

| # | Risque | Correction requise |
|---|---|---|
| 5 | Super Admin bypass générique via `has_role(..., 'super_admin')` | Remplacer par vérification capability effective (DELEGATE/GRANT sur rbac.*) ou documenter comme exception unique bootstrap. |
| 6 | Merge `true l'emporte` empêche désactivation via grant | Documenter : "pour désactiver, utiliser revoke_role_permission" — ou ajouter paramètre `p_mode: 'merge' | 'replace'`. |
| 7 | Scope `role` non testé / Decision 1 non codifiée | Ajouter commentaire explicite dans code : `scope_value` = rôle bénéficiaire. Tests manuels requis. |

### 🟡 Mineurs

| # | Risque | Correction |
|---|---|---|
| 8 | Messages d'erreur en français (parsing frontend) | Standardiser codes d'erreur (ex: `ERROR_CODE.INSUFFICIENT_AUTHORITY`) + message. |
| 9 | `revoke_role_permission` supprime ligne si toutes false — pas de trace | Ajouter `deleted_at` soft delete ou table audit future. |
| 10 | Pas de validation `p_scope_type` ∈ ('global','role','user') | Ajouter CHECK ou validation explicite. |

---

## RÈGLES EXACTES MANAGE / GRANT / DELEGATE (ÉTAT ACTUEL)

| Capability | Sur permission | Utilisation dans Phase 1 |
|---|---|---|
| **MANAGE** | `rbac.role_permissions` | **Seule porte d'entrée** pour toutes mutations (grant + revoke). Équivaut à "admin config RBAC". |
| **GRANT** | `rbac.role_permissions` | **Inutilisée**. Devrait contrôler attribution de permissions à d'autres rôles. |
| **DELEGATE** | `rbac.role_permissions` | **Inutilisée**. Devrait contrôler création de délégations sur la config RBAC. |
| **USE** | `rbac.role_permissions` | **Inutilisée** (sauf get_role_permission qui ne la vérifie pas). |
| **USE/MANAGE/GRANT/DELEGATE** | Permission CIBLE (`p_permission_id`) | Vérifiées **une par une** en anti-escalade (ligne 162-174) : l'acteur doit posséder chaque capability qu'il veut accorder. |

---

## CONCLUSION

**Phase 1 déployée mais non sécurisée pour production.**

### Actions requises avant Phase 2 :
1. **Corriger** la confusion MANAGE/GRANT (décider et implémenter la règle)
2. **Blinder** auto-GRANT et auto-révocation via délégation
3. **Sécuriser ou supprimer** `get_role_permission`
4. **Documenter** l'exception Super Admin précisément (pas de bypass générique)
5. **Tester** au minimum scénarios A, C, E, F, I, L, M, S

### Phase 2 (role_delegations) — **NE PAS COMMENCER** tant que ci-dessus non résolu.

---

**Rapport généré sans modification de code. En attente de décision utilisateur.**