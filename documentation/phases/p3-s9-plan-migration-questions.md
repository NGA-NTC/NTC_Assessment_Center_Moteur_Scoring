# P3-S9 — Plan de migration des questions et des logiques de calcul

> **Statut : PROPOSITION — en attente de validation avant toute exécution.**
> Prérequis remplis : persistance Supabase opérationnelle (P3-S8 validée : autosave, restauration, RLS).
> Règle transversale : **zéro régression** (autosave, Résultats, RBAC) et **compatibilité totale avec les 197 questions / réponses déjà enregistrées**.

---

## 0. Objectif

Faire évoluer les **questions** (aujourd'hui statiques dans `src/data/`) vers une gestion pilotée en base Supabase, et clarifier où vivent les **logiques de calcul** (scoring), sans casser le questionnaire existant.

## 1. Inventaire exact de l'existant (vérifié)

- **Données statiques** (`src/data/`) : `battery1.js` … `battery8.js`, `batteries.js` (métadonnées : type correct/weighted/rubric/coherence), `dimensions.js` (44 dimensions → axes), `index.js` (exports `BATTERIES`, `AXES`, `DIMS`, `DIM`, `ROLES`, `METIERS`).
- **Total : 197 questions** (compté par exécution de `accountProgress`).
- **Scoring** (`src/lib/scoring.js`) : `computeDimensionScores`, `computeCoherence`, `computeAxisScores`, `computeRoleFit`, `generateReport`, `accountProgress`, `progress` — **100% côté client**, aucune dépendance réseau.
- **Clés de réponses déjà persistées** (P3-S8, production) : `mcq:<clé>`, `b7:<caseId>:<dimKey>`, `b8:<itemId>:<champ>` → **ce sont les clés de jointure questions ↔ réponses**. Elles ne doivent JAMAIS changer, sinon les réponses existantes deviennent orphelines.

## 2. Contrainte de sécurité structurante (à arbitrer — point de décision n°1)

La batterie B1 est de type **« correct »** : son barème (bonne réponse par question) est actuellement dans le bundle client. Deux options :

| Option | Description | Avantages | Risques / coût |
|---|---|---|---|
| **A — Barème serveur uniquement** (recommandée à terme) | Les clés de correction ne sont JAMAIS lisibles par le candidat. Le scoring B1 passe par un RPC SECURITY DEFINER. | Anti-triche réel ; questions 100% en base | Scoring partiellement migré vers SQL/RPC ; plus de travail ; le rapport complet dépend du scoring global |
| **B — Statu quo barème client** | Questions en base pour le contenu, barème B1 conservé côté client (comme aujourd'hui). | Zéro changement de scoring, phase courte | Le candidat motivé peut lire le barème dans le bundle (déjà le cas aujourd'hui) |

> Recommandation : **B pour P3-S9** (contenu en base, scoring inchangé), puis option A en phase ultérieure dédiée. Cela borne le risque de régression.

## 3. Schéma cible proposé (migration SQL `2026xxxx_p3s9_assessment_questions.sql`)

```sql
-- Contenu des questions (versionné, immuable par clé)
create table assessment_questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id text not null,              -- 'ntc-assessment'
  battery_id    int  not null,              -- 1..8
  question_id   text not null,              -- clé STABLE = clé des réponses (ex: 'Q1', 'CAS1:leadership', 'S1:observation')
  content       jsonb not null,             -- énoncé, options, métadonnées (SANS barème pour B1 en option A)
  display_order int  not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- La clé métier est (assessment_id, question_id) : unique, stable.
alter table assessment_questions
  add constraint assessment_questions_key_unique unique (assessment_id, question_id);
create index assessment_questions_battery_idx on assessment_questions (battery_id, display_order);

-- (Option A, plus tard) barèmes isolés, sans SELECT pour les candidats :
-- assessment_answer_keys (question_id, correct/weights, ...)
```

**RLS proposée** :
- `SELECT` pour `authenticated` sur les lignes `is_active = true` (contenu des énoncés/options) — **jamais** de colonne barème dans `content` si option A retenue ;
- écritures : `service_role` / SQL Editor uniquement (pas de policy d'écriture front).

**Service** : `src/services/assessments/questions.js` — `listQuestions(assessmentId)` avec **cache mémoire de session** + **fallback statique** (`src/data/`) si la table est vide/indisponible → le questionnaire fonctionne en toutes circonstances.

## 4. Ce qui NE change PAS (garde-fous)

- Les composants du questionnaire (`McqBattery`, `RubricBattery`, `CoherenceBattery`, `QuestionCard`, `OptionButton`, navigation par batteries).
- Les clés `question_id` (donc les réponses P3-S8 déjà en production).
- Le format de persistance (`assessment_responses.answer` jsonb) et l'autosave.
- `buildCandidates`, Résultats, RBAC, routes.

## 5. Découpage en sous-étapes (même mode opératoire que S1→S8 : une sous-étape = une validation)

| Sous-étape | Contenu | Validation |
|---|---|---|
| **S9-1** | Migration SQL `assessment_questions` + RLS + génération du **seed** par script (à partir des fichiers `src/data/` → JSON de revue) ; exécution par vous dans le SQL Editor | Requêtes de contrôle : 197 lignes, unicité des clés, correspondance 1:1 avec le statique |
| **S9-2** | Service `questions.js` (lecture + cache + fallback statique) ; TestApp consomme le service ; test de non-régression autosave (harnais 20/20 + nouveaux tests) | Questionnaire identique en écran ET en comportement ; clés identiques |
| **S9-3** | Cohérence clés : script de vérification croisée (chaque réponse persistée ↔ question active ; toute question active ↔ clé attendue par le scoring) | Aucune réponse orpheline |
| **S9-4 (option)** | Administration du contenu dans le Super Admin (CRUD questions, via RPC SECURITY DEFINER) | Hors scope si non souhaité |
| **S9-5 (option, barème serveur = point n°2 option A)** | RPC scoring B1 + retrait du barème du bundle | Décision dédiée |

**Chaque sous-étape s'arrête pour votre validation** (votre règle depuis S1).

## 6. Stratégie de rollback

- Le **fallback statique** reste fonctionnel tant qu'il n'est pas supprimé → en cas de problème, désactivation du service (une ligne) → retour au comportement actuel sans perte.
- La migration SQL est additive (aucune table/colonne existante modifiée, aucune donnée réponse touchée).

## 7. Tests prévus (critères d'acceptation P3-S9)

1. Les 197 questions servies depuis Supabase sont **identiques** (contenu + ordre) à la version statique (diff automatisé).
2. Questionnaire : répondre Q1→Q3, refresh, reconnexion → réponses restaurées (comportement P3-S8 inchangé, harnais étendu).
3. Résultats : progression et scoring identiques avant/après (mêmes réponses → mêmes scores).
4. Candidat authentifié lit les questions ; anonyme non ; aucune clé de barème exposée (option A) ou statu quo documenté (option B).
5. `pnpm lint`, `pnpm build`, console sans erreur, responsive 1440→375.

## 8. Points à arbitrer avant démarrage (réponses attendues)

1. **Barème B1** : option B (statu quo client, recommandé pour S9) ou option A (RPC serveur) ?
2. **Périmètre** : S9-1 → S9-3 uniquement, ou inclure S9-4 (admin du contenu) ?
3. **Seed** : les fichiers `src/data/` restent-ils la source de vérité initiale (recommandé), avec gel ultérieur ?
4. **Versionning du contenu** : une modification d'énoncé après mise en production des réponses doit-elle créer une nouvelle `display_version` (historisation) ou être interdite (questions immuables) ?
