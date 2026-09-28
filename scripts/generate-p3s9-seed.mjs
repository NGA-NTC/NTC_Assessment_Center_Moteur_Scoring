/* S9-1 — Générateur du seed `assessment_questions` (déterministe).
   Source de vérité : src/data (fichiers statiques).
   Modèle : 1 LIGNE PAR QUESTION (item) — 197 attendues.
     - B1..B6 (mcq)  : question_id = "mcq:<item.id>"      → 1 clé de réponse
     - B7 (rubric)   : question_id = "b7:<item.id>"       → clés b7:<id>:<dim> (+ :text)
     - B8 (coherence): question_id = "b8:<item.id>"       → clés b8:<id>:<champ> (+ :text)
   Les clés de réponses (P3-S8, production) se dérivent du question_id racine
   + des champs du content : elles ne doivent JAMAIS être renommées.
   Sorties :
     - supabase/migrations/20260928_p3s9_assessment_questions.sql
     - scripts/p3s9-seed-control.json (contrôles de correspondance) */
import { writeFileSync } from "node:fs";
import { createServer } from "vite";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  plugins: [{
    name: "p3s9-gen-stub",
    enforce: "pre",
    resolveId(id) {
      if (id.includes("lib/supabaseClient.js")) return pathToFileURL(resolve("scripts/p3s8-supabase-stub.mjs")).href;
      return null;
    },
  }],
});

const data = await vite.ssrLoadModule("/src/data/index.js");
const scoring = await vite.ssrLoadModule("/src/lib/scoring.js");
// Dimensions de notation B7 (identiques à RubricBattery) : chaque cas est
// noté sur ces 5 dimensions + un champ texte.
const B7_DIMS = ["NST", "PRO", "PRI", "GCH", "VS"];

const ASSESSMENT_ID = "ntc-assessment";

function sqlString(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// Dérivation EXACTE des clés de réponse (même logique que scoring.progress,
// RubricBattery et services/assessments/responses.js) — sert au contrôle
// structurel et garantit l'anti-orphelinage.
function responseKeysFor(battery, item) {
  if (battery.type === "correct" || battery.type === "weighted") return ["mcq:" + item.id];
  if (battery.type === "rubric") {
    return B7_DIMS.map((d) => `b7:${item.id}:${d}`).concat([`b7:${item.id}:text`]);
  }
  return [...(item.watch || []), "text"].map((f) => `b8:${item.id}:${f}`);
}

const rows = [];
const answerKeyIndex = [];
let order = 0;
let totalAnswerKeys = 0;

for (const battery of data.BATTERIES) {
  battery.items.forEach((item) => {
    order += 1;
    const rootId =
      battery.type === "correct" || battery.type === "weighted"
        ? "mcq:" + item.id
        : (battery.type === "rubric" ? "b7:" + item.id : "b8:" + item.id);
    const keys = responseKeysFor(battery, item);
    totalAnswerKeys += keys.length;
    answerKeyIndex.push(...keys.map((k) => ({ question_id: rootId, response_key: k })));
    rows.push({ battery_id: battery.id, question_id: rootId, order, content: item });
  });
}

// ---- Contrôles du générateur (garde-fous) ---------------------------------
const totalQuestions = data.BATTERIES.reduce((n, b) => n + b.items.length, 0);
const progress = scoring.accountProgress({ mcq: {}, b7: {}, b8: {} });
if (totalQuestions !== progress.total) {
  throw new Error(`Incohérence items : ${totalQuestions} vs scoring ${progress.total}`);
}
const seen = new Map();
for (const r of rows) {
  if (seen.has(r.question_id)) throw new Error("DUPLICATE question_id: " + r.question_id);
  seen.set(r.question_id, r);
}
// Structure : chaque item B8 doit exposer `watch` (sinon clés non dérivables)
for (const battery of data.BATTERIES) {
  if (battery.type !== "rubric" && battery.type !== "correct" && battery.type !== "weighted") {
    battery.items.forEach((it) => {
      if (!Array.isArray(it.watch)) throw new Error("B8 sans watch : " + it.id);
    });
  }
}

// ---- Génération SQL --------------------------------------------------------
const values = rows.map((r) =>
  `  (${sqlString(ASSESSMENT_ID)}, ${r.battery_id}, ${sqlString(r.question_id)}, ${sqlString(JSON.stringify(r.content))}::jsonb, ${r.order})`
);

const byBattery = data.BATTERIES.map((b) => ({
  battery_id: b.id,
  type: b.type,
  items: b.items.length,
  questions: rows.filter((r) => r.battery_id === b.id).length,
  answer_keys: answerKeyIndex.filter((k) => k.question_id.startsWith(
    b.type === "correct" || b.type === "weighted" ? "mcq:" : (b.type === "rubric" ? "b7:" : "b8:")
  )).length,
}));

const sql = `-- ============================================================================
-- P3-S9-1 : Migration des QUESTIONS vers Supabase (source : src/data)
-- Modèle : 1 ligne par question (item) — ${rows.length} questions attendues.
-- question_id = clé racine de persistance (mcq:* / b7:* / b8:*) : les clés de
-- réponses P3-S8 (ex: b7:<case>:<dim>) se dérivent du racine + champs du
-- content et NE DOIVENT JAMAIS être renommées (compatibilité historique).
-- Idempotent : TRUNCATE du contenu avant re-seed (aucune table de réponses
-- touchée). À exécuter dans le SQL Editor (sonylnjcekfxdnhmfkll).
-- ============================================================================

create table if not exists public.assessment_questions (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  text not null,
  battery_id     int  not null,
  question_id    text not null,
  content        jsonb not null,
  display_order  int  not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'assessment_questions_key_unique'
  ) then
    alter table public.assessment_questions
      add constraint assessment_questions_key_unique unique (assessment_id, question_id);
  end if;
end $$;

create index if not exists assessment_questions_battery_idx
  on public.assessment_questions (battery_id, display_order);

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create function public.set_updated_at() returns trigger
    language plpgsql as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'assessment_questions_set_updated_at'
  ) then
    create trigger assessment_questions_set_updated_at
      before update on public.assessment_questions
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Seed déterministe (généré par scripts/generate-p3s9-seed.mjs)
-- ${rows.length} questions — ${totalAnswerKeys} clés de réponses dérivables
-- ---------------------------------------------------------------------------
truncate table public.assessment_questions;

insert into public.assessment_questions
  (assessment_id, battery_id, question_id, content, display_order)
values
${values.join(",\n")};

-- ---------------------------------------------------------------------------
-- RLS : lecture du contenu pour authenticated (lignes actives uniquement) ;
-- aucune écriture front (service_role / SQL Editor seulement).
-- ---------------------------------------------------------------------------
alter table public.assessment_questions enable row level security;

drop policy if exists questions_select_authenticated on public.assessment_questions;
create policy questions_select_authenticated on public.assessment_questions
  for select to authenticated
  using (is_active = true);

-- Contrôles post-exécution (SQL Editor) :
--   select count(*) from public.assessment_questions;                    -- attendu : ${rows.length}
--   select count(distinct question_id) from public.assessment_questions; -- attendu : ${rows.length}
--   select battery_id, count(*) from public.assessment_questions group by battery_id order by battery_id;
-- Fin de migration P3-S9-1.
`;

const outSql = resolve(__dirname, "../supabase/migrations/20260928_p3s9_assessment_questions.sql");
writeFileSync(outSql, sql, "utf8");

const outJson = resolve(__dirname, "p3s9-seed-control.json");
writeFileSync(outJson, JSON.stringify({
  generatedAt: new Date().toISOString(),
  assessmentId: ASSESSMENT_ID,
  totals: { questions: rows.length, items: totalQuestions, scoringTotal: progress.total, answerKeys: totalAnswerKeys, batteries: data.BATTERIES.length },
  byBattery,
  questions: rows.map((r) => ({ battery_id: r.battery_id, question_id: r.question_id, display_order: r.order })),
  answerKeys: answerKeyIndex,
}, null, 2), "utf8");

await vite.close();

console.log(`OK — ${rows.length} questions (items) ; scoring attendu : ${progress.total} ; clés de réponses dérivables : ${totalAnswerKeys}`);
console.log(`SQL écrit : ${outSql}`);
console.log(`Contrôle écrit : ${outJson}`);
console.log(byBattery.map((b) => `B${b.battery_id}(${b.type})=${b.questions}q/${b.answer_keys}clés`).join(" "));
process.exit(0);
