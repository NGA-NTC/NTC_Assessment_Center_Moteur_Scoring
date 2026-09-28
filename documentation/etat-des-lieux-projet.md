# État des lieux du projet — NTC Assessment Center Moteur Scoring

> Dernière mise à jour : 2026-09-28 (après validation P3-S8 + correctif Résultats/HTTP 400).
> Document d'inventaire **factuel** : tout ce qui y figure a été vérifié dans le code, la configuration ou en exécution.

---

## 1. Vue d'ensemble

Plateforme d'évaluation psychométrique (« Assessment Center ») :

- **Questionnaire candidat** : 8 batteries, **197 questions** au total (compté par exécution de `accountProgress` sur les données réelles) — B1 QCM à correction, B2–B6 QCM pondérés, B7 étude de cas notée par rubrique (4 niveaux), B8 simulation intégrée (intensités + texte).
- **Moteur de scoring côté client** : 44 dimensions → 8 axes (dont cohérence comportementale) → adéquation à 5 métiers → rapport (forces/vigilance).
- **Espace admin** : Résultats (liste/cards, filtres, progression temps réel, export PDF/JSON, mise à jour par import), Utilisateurs.
- **Espace Super Admin** : Dashboard, Comptes, Rôles, Accès (permissions USE/MANAGE/GRANT/DELEGATE + matrice d'assignabilité), Pages, Fonctionnalités.
- **RBAC complet** : rôles, permissions à 4 capacités, délégations, assignable-roles.

## 2. Stack technique (package.json vérifié)

| Domaine | Technologie | Version |
|---|---|---|
| UI | React | 19.2 |
| Build | Vite (rolldown) | 8.2 |
| Routing | react-router-dom | 7.18 |
| Styles | Tailwind CSS (plugin Vite) | 4.3 |
| Primitives | shadcn/Radix (alert-dialog, avatar, checkbox, dialog, dropdown-menu, label, popover, progress, radio-group, select, separator, slot, switch, tabs, toggle, toggle-group, tooltip) | dernières |
| Graphiques | Recharts (radar) | 3.10 |
| Backend BaaS | @supabase/supabase-js | 2.116 |
| Notifications | sonner | 2.0 |
| Lint | ESLint 10 (+ react-hooks, react-refresh) | — |
| Icônes | lucide-react | 1.41 |
| CLI | supabase CLI (devDependency) | 2.117 |

Scripts : `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm preview`.

## 3. Frontend

### Structure `src/`
- `pages/` (19 pages) — questionnaire (`TestApp`), résultats (`AdminResultats`), auth (Login/UserLogin/Register/ForgotPassword/ResetPassword/ChangePassword), Profil, Admin (Users/UserDetail/ModeTest), SuperAdmin (Dashboard/Accounts/Roles/Access/Pages/Features), vue résultats (`ResultsView`).
- `components/` : `ui/` (wrappers métier + `primitives/` Radix), `common/` (ConfirmDialog, ResponsiveDataTable, FilterSelect, StatusBadge…), `layout/` (AppShell, AuthShell, sidebars, ThemeToggle), `question/` (McqBattery, RubricBattery, CoherenceBattery, QuestionCard, OptionButton…), `admin/` (RoleAssignabilityMatrix).
- `services/` : `assessments/` (attempts.js, responses.js — P3-S8), `auth/` (signUp, candidates, users), `rbac/` (roles, rolePermissions, roleAssignability, assignableRoles, accessControl), `pages/`, `features/`, `dashboard/`.
- `context/` : UserAuthProvider (session, profil, rôles, permissions, register/login/logout/reset/update), AdminAuthProvider, ThemeContext + hooks alias.
- `routes/` : registre (`registry/index.jsx`, 19 routes listées plus bas) + guards (ProtectedRoute, UserRoute, SuperAdminRoute) + lazy loading de toutes les pages (P3-S2).
- `data/` : les **questions sont encore statiques** (batteries 1–8, dimensions.js) — c'est l'objet de P3-S9.
- `lib/` : scoring.js (calculs), candidates.js (buildCandidates : fusion Supabase + legacy + imports), storage.js (legacy localStorage + `ensureLocalAccount`), export.js (PDF/JSON), supabaseClient.js.
- `styles/` + `index.css` : tokens sémantiques unifiés (light/dark), `--ntc-font-serif` source unique (P3-S6).
- `i18n/`, `hooks/`, `constants/`, `reponses/` (données d'exemple).

### Routes (registre réel)
`/` (redirect), `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/login`, `/test` (UserRoute), `/modifier-mot-de-passe`, `/compte`, `/admin` (guard admin + `results.view`), `/admin/utilisateurs`, `/admin/mode-test/:id`, `/super-admin*` (4 pages), catch-all `*` → `/connexion`.

### Qualité
- ESLint : **0 erreur / 0 warning**.
- Build : ~1 s, **60 chunks** — code splitting P3-S2 (main 600,6 kB / gzip 176,3 ; Recharts isolé dans le chunk AdminResultats 322 kB ; scoring 94 kB).
- Inline styles : ~65 restants, tous dynamiques/calculés ou conditionnels métier (audit P3-S4/S6).
- A11y : focus-visible global (anneau `--ring`), aria-pressed/labels sur les contrôles, contrastes corrigés en dark (P3-S6/S7).

## 4. Backend — Supabase (projet en ligne `sonylnjcekfxdnhmfkll`)

### Tables (schéma réel vérifié)
- `profiles` — clé **`id`** (référence auth.users), email, first_name, last_name, created_at, updated_at. ⚠️ La clé est `id`, **pas** `user_id` (cause du 400 corrigé).
- `user_roles` (user_id, role_id) · `roles` (id text, name, description, is_assignable, parent_id, is_system) · `role_permissions` (role_id, permission_id, use/manage/grant/delegate) · `permissions` (id, name, category…).
- `pages`, `features`, `page_features` (catalogue navigation Super Admin, fallback `DEFAULT_PAGES` côté front).
- **`assessment_attempts`** (P3-S8) : id uuid, user_id → auth.users CASCADE, assessment_id text, status CHECK (in_progress/completed/abandoned), current_question_id, started_at, last_activity_at, completed_at. **UNIQUE (user_id, assessment_id)**.
- **`assessment_responses`** (P3-S8) : id uuid, attempt_id → CASCADE, question_id text, answer **jsonb**, answered_at, updated_at (trigger `set_updated_at`). **UNIQUE (attempt_id, question_id)**.

### RPC (SECURITY DEFINER, pattern du projet)
`admin_get_users` (protégé : « permission users.view requise » — vérifié), `admin_create_user`, `assign_user_role`, `revoke_user_role`, `admin_set_user_active`. Edge function : `admin-reset-password`.

### RLS
- `profiles` : lecture self ; lecture multi-profils **non accordée** aux clés front (le RPC admin sert d'intermédiaire).
- `assessment_attempts` / `assessment_responses` : CRUD self (candidat propriétaire), **SELECT** pour rôles « Administrateur »/« Super Administrateur », rien pour anon (vérifié : 200 + 0 ligne en anonyme).
- Aucune écriture admin sur les réponses (anti-élévation conservée).

### Persistance des réponses (P3-S8, validée en production)
- Source de vérité : **Supabase** (attempts + responses). Autosave debounced 400 ms, upsert incrémental par diff, position (`current_question_id`) et statut sauvegardés, retry visible en cas d'erreur réseau.
- Identifiants de questions persistés : `mcq:<clé>`, `b7:<caseId>:<dim>`, `b8:<itemId>:<champ>` — **doivent être conservés tels quels** par la migration P3-S9 des questions (compatibilité des réponses déjà enregistrées).
- Backfill unique de l'ancien cache local (drapeau `ntc_p3s8_backfilled`, fusion non-destructive) ; le store legacy `ntc_users` reste en **repli** si Supabase est indisponible.
- Tests : `scripts/verify-p3s8.mjs` (harnais Vite SSR + stub Supabase avec sémantique RLS) — **20/20 PASS**.

## 5. Environnements

| Environnement | État |
|---|---|
| **En ligne (référence)** | Projet Supabase `sonylnjcekfxdnhmfkll` via `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_SITE_URL=https://ntc-assessment-center-moteur-scorin.vercel.app`). `.env` à ne jamais modifier. |
| **Local** | Instance Supabase Docker **désactivée** : `.env.local` renommé `.env.local.bak-supabase-local` (à ne pas réintroduire). Le front pointe donc toujours vers l'online, même en dev. |
| **Comptes** | Admin réel : `r.harenafitia.donkael@gmail.com` (online uniquement). Candidat de test local historique : `p2.smoke@codebuff.dev` (Docker local seulement, plus actif). |
| **Dev server** | `pnpm dev`. Port 5253 (config) et 5199 (ancien fallback) **exclus par Windows** (plages WinNAT 5243–5342 / 5143–5242, EACCES au bind). Fallback opérationnel : **`http://127.0.0.1:5350/`** (`--host 127.0.0.1`). Plages exclues susceptibles de changer à chaque reboot (`netsh interface ipv4 show excludedportrange protocol=tcp`). |
| **Preview prod** | `pnpm vite preview --port 4173` (à killer après usage ; peut binder `[::1]`). |
| **Production** | Déploiement Vercel (URL publique ci-dessus), build Vite standard. |

## 6. Historique des phases (résumé)

| Phase | Contenu | État |
|---|---|---|
| P0/P1/P2 | Migration shadcn/Radix, guards, audit sécurité auth (3 régressions corrigées, alias morts supprimés) | ✅ validée |
| P3-S1 | IntensityToggle → ToggleGroup Radix ; sr-only ResponsesReview | ✅ validée |
| P3-S2 | Lazy routes + Suspense ; main 1237→597 kB (gzip 360→175) ; Recharts isolé | ✅ validée |
| P3-S3 | LoadingState partout (pages + guards), boutons connexion avec `loading` | ✅ validée |
| P3-S4 | Cleanup UI AdminResultats (40→3 inline styles, 7 constantes de thème supprimées, EmptyState, Button) | ✅ validée |
| P3-S5 | Harmonisation Auth + Profile (56→1 inline styles, tokens sémantiques, dvh) | ✅ validée |
| P3-S6 | Serif unifié (`--ntc-font-serif`), matrice RBAC responsive, Spinner supprimé, radar mobile, audit primitives | ✅ validée |
| P3-S7 | Autosave rétabli (miroir local), Résultats 0% visibles, FilterDropdown responsive, dark tabs/badges, tables SuperAdmin → ResponsiveDataTable | ✅ validée |
| P3-S8 | Persistance Supabase (migration SQL + services + TestApp + AdminResultats), fix 400 (`profiles.id`), RLS vérifiée, 20/20 tests | ✅ validée |

## 7. Points de vigilance connus

1. **E2E** : `bk1-e2e.js`, `smoke2.js`, `smoke3.js` n'existent pas dans le dépôt (signalé à chaque rapport).
2. **localStorage** : le repli legacy et le backfill restent en place (suppression propre à planifier après P3-S9).
3. **Ports Windows** : plages exclusives dynamiques (WinNAT) — vérifier avant chaque session de dev ; le fix permanent (libération winnat + exclusion statique de 5253) n'a pas été appliqué.
4. **GA bloqué** : `ERR_BLOCKED_BY_CLIENT` sur Google Analytics = bloqueur de pub du navigateur, sans impact.
5. **Profils en lecture directe** : la lecture multi-profils reste fermée par RLS ; toute nouvelle fonctionnalité admin doit passer par RPC SECURITY DEFINER.
6. **Migration non versionnée en CLI** : appliquée via SQL Editor en production (pas de dossier `supabase/migrations` historisé côté projet) — le fichier `supabase/migrations/20260928_p3s8_assessment_persistence.sql` sert de référence.
