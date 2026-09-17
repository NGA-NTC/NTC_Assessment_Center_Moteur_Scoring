# P1.3.4-B-S2-B-PHASE-1 STATUS

## Migration
- **Fichier** : `supabase/migrations/20260917140000_p1_3_4_b_s2_b_phase1_role_permissions.sql`
- **Statut** : Appliquée avec succès sur le remote (supabase db push OK)
- **Historique migrations** : Local ↔ Remote synchronisés (10 migrations communes)

## RPC créées

| Fonction | Type | Sécurité | Paramètres | Retour |
|---|---|---|---|---|
| `grant_role_permission` | Mutation | SECURITY DEFINER, search_path=public | target_role_id, permission_id, capabilities(jsonb), scope_type, scope_value | void |
| `revoke_role_permission` | Mutation | SECURITY DEFINER, search_path=public | target_role_id, permission_id, capabilities(text[]), scope_type, scope_value | void |
| `get_role_permission` | Lecture | SECURITY DEFINER (stable), search_path=public | role_id, permission_id | jsonb |

## Sécurité

✅ **SECURITY DEFINER** sur toutes les fonctions de mutation
✅ **SET search_path = public** sur toutes les fonctions
✅ **auth.uid()** utilisé comme acteur réel (pas de user_id paramètre)
✅ **has_effective_capability()** réutilisée (S1) pour vérification autorité
✅ **scope_includes()** réutilisée (S1) via has_effective_capability
✅ **EXECUTE GRANT** : `authenticated` uniquement, `anon` révoqué
✅ **RLS inchangées** : aucune policy modifiée, aucun USING(true)
✅ **Pas d'exposition directe** : tables `role_permissions`, `permissions`, `roles` non modifiables directement

## Permissions RBAC créées

| Permission | Category | Super Admin capabilities |
|---|---|---|
| `rbac.role_permissions` | rbac | USE, MANAGE, GRANT, DELEGATE |
| `rbac.role_delegations` | rbac | USE, MANAGE, GRANT, DELEGATE |
| `rbac.user_delegations` | rbac | USE, MANAGE, GRANT, DELEGATE |
| `rbac.role_assignability` | rbac | USE, MANAGE, GRANT, DELEGATE |

## Anti-escalade implémenté

| Protection | grant_role_permission | revoke_role_permission |
|---|---|---|
| Authentification requise | ✅ | ✅ |
| MANAGE sur rbac.role_permissions | ✅ | ✅ |
| Scope demandé ⊆ scope détenu | ✅ (via has_effective_capability) | ✅ |
| Capability demandée ≤ capability détenue | ✅ (boucle sur chaque cap) | N/A (révocation) |
| Rôle cible existe | ✅ | ✅ |
| Permission cible existe | ✅ | ✅ |
| Auto-révocation MANAGE/GRANT/DELEGATE sur rbac.role_permissions | N/A | ✅ (sauf super_admin) |
| Pas de DELEGATE sans DELEGATE | ✅ (vérification capability par capability) | N/A |

## Tests

| # | Scénario | Statut | Note |
|---|---|---|---|
| 1 | Utilisateur non authentifié → refus | **NON TESTÉ** | Nécessite appel RPC sans auth |
| 2 | Authentifié sans rbac.role_permissions → refus | **NON TESTÉ** | Nécessite user sans rôle super_admin |
| 3 | rbac.role_permissions + capacité insuffisante → refus | **NON TESTÉ** | Nécessite user avec USE seulement |
| 4 | Autorisé dans scope → succès | **NON TESTÉ** | Nécessite super_admin |
| 5 | Rôle hors scope → refus | **NON TESTÉ** | Nécessite délégation scope restreint |
| 6 | Permission inexistante → refus | **NON TESTÉ** | |
| 7 | Rôle inexistant → refus | **NON TESTÉ** | |
| 8 | Duplication → comportement contrôlé (upsert) | **NON TESTÉ** | |
| 9 | Modification capabilities → succès si autorisé | **NON TESTÉ** | |
| 10 | Suppression → succès si autorisé | **NON TESTÉ** | |
| 11 | Expiration autorité → refus | **NON TESTÉ** | Nécessite user_role expiré |
| 12 | Révocation autorité → refus | **NON TESTÉ** | Nécessite user_role révoqué |
| 13 | Capability supérieure à détenue → refus | **NON TESTÉ** | |
| 14 | Créer DELEGATE sans DELEGATE → refus | **NON TESTÉ** | |
| 15 | Élargir scope → refus | **NON TESTÉ** | |
| 16 | Plusieurs rôles → autorité fusionnée | **NON TESTÉ** | |

**Tous les tests sont NON TESTÉS** — impossible d'exécuter les RPC sans environnement de test (Docker non disponible localement, pas d'Edge Function de test déployée, pas de client SQL direct configuré).

## Remote
✅ Migration pushée et appliquée
✅ Historique migrations synchronisé
✅ Aucune erreur lors du push

## Frontend modifié
❌ **NON** — Aucune modification frontend

## Régressions
❌ **AUCUNE** — Migration additive seulement, fonctions SECURITY DEFINER, RLS inchangées

## Points d'attention

1. **Tests non exécutables** : Environnement de test non disponible (Docker arrêté). Les tests doivent être effectués manuellement ou via CI/CD une fois configuré.

2. **Scope 'role' non testé** : La logique `scope_includes('role', X, 'user', U)` est réutilisée de S1 mais n'a pas été testée avec les nouvelles RPC.

3. **Auto-révocation** : La protection contre l'auto-révocation de MANAGE/GRANT/DELEGATE sur `rbac.role_permissions` ne vérifie que si l'acteur a le rôle cible. Elle ne couvre pas le cas où l'acteur a la capacité via délégation (pas via rôle direct). Acceptable pour Phase 1.

4. **grant_role_permission merge behavior** : Le merge `true l'emporte sur false` signifie qu'on ne peut pas *désactiver* une capability via grant (il faut revoke). C'est intentionnel.

5. **Super Admin bypass** : `has_role(auth.uid(), 'super_admin')` permet de bypass l'auto-révocation. C'est intentionnel pour bootstrap/maintenance.

6. **Error messages** : En français avec codes préfixés (ex: `ESCALADE_INTERDITE:`). Frontend futur peut parser le préfixe.

## Prochaine étape

**Phase 2** : `role_delegations` (création/révocation) — **EN ATTENTE DE VALIDATION**

---

**P1.3.4-B-S2-B-PHASE-1 = COMPLETE (migration appliquée, fonctions créées, sécurité vérifiée, tests en attente d'environnement)**