/* Tests S9-3 : cohérence questions ↔ réponses (module pur + chaîne réelle).
   Garde-fous : lecture seule, ni scoring ni clés ni autosave ni RLS modifiés.
   1. Dérivation : 299 clés attendues + 197 racines depuis le statique
   2. Symétrie seed ↔ moteur : p3s9-seed-control.json ⊆ racines dérivées
   3. Round-trip complet : 299 clés écrites via saveResponses → relues →
      checkResponsesCoherence = cohérent (B1→B8, 178 mcq / 54 b7 / 67 b8)
   4. Réponses partielles : 3 lignes → 0 orpheline, 2 racines couvertes
   5. Orphelines : clé hors dataset, clé mal formée, famille inconnue
   6. Identité statique ↔ Supabase des clés dérivées (loadBatteries)
   7. Répartition par batterie (32/28/30/28/32/28/9/10) et couverture racines */
import { createServer } from "vite";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stub = await import("./p3s8-supabase-stub.mjs");

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  plugins: [{
    name: "p3s9-3-stub",
    enforce: "pre",
    resolveId(id) {
      if (id.includes("lib/supabaseClient.js")) return pathToFileURL(resolve("scripts/p3s8-supabase-stub.mjs")).href;
      return null;
    },
  }],
});

const coherence = await vite.ssrLoadModule("/src/services/assessments/coherence.js");
const questionsSvc = await vite.ssrLoadModule("/src/services/assessments/questions.js");
const attemptsSvc = await vite.ssrLoadModule("/src/services/assessments/attempts.js");
const responsesSvc = await vite.ssrLoadModule("/src/services/assessments/responses.js");
const data = await vite.ssrLoadModule("/src/data/index.js");

let failures = 0;
function check(label, cond) {
  console.log((cond ? "PASS" : "FAIL") + " - " + label);
  if (!cond) failures++;
}

const ctl = JSON.parse(readFileSync(resolve(__dirname, "p3s9-seed-control.json"), "utf8"));
const itemByKey = new Map();
for (const b of data.BATTERIES) {
  const prefix = b.type === "correct" || b.type === "weighted" ? "mcq:" : (b.type === "rubric" ? "b7:" : "b8:");
  b.items.forEach((it) => itemByKey.set(prefix + it.id, it));
}
function makeRows() {
  return ctl.questions.map((q) => ({
    assessment_id: "ntc-assessment",
    battery_id: q.battery_id,
    question_id: q.question_id,
    content: JSON.parse(JSON.stringify(itemByKey.get(q.question_id))),
    display_order: q.display_order,
    is_active: true,
  }));
}

/** Forme {mcq,b7,b8} couvrant TOUTES les clés attendues (299). */
function fullResponsesShape(batteries) {
  const shape = { mcq: {}, b7: {}, b8: {} };
  for (const b of batteries) {
    for (const it of b.items) {
      if (b.type === "correct" || b.type === "weighted") shape.mcq[it.id] = "A";
      else if (b.type === "rubric") shape.b7[it.id] = { NST: 1, PRO: 2, PRI: 3, GCH: 4, VS: 1, text: "t" };
      else shape.b8[it.id] = { ...Object.fromEntries((it.watch ?? []).map((f) => [f, "leger"])), text: "t" };
    }
  }
  return shape;
}

try {
  // ---- 1. Dérivation depuis le statique ------------------------------------
  const statique = coherence.expectedKeySetFromBatteries(data.BATTERIES);
  check("1 : 299 clés attendues dérivées du statique", statique.keys.size === 299);
  check("1 : 197 racines de questions dérivées", statique.roots.size === 197);

  // ---- 2. Symétrie seed ↔ moteur --------------------------------------------
  const seedRoots = new Set(ctl.questions.map((q) => q.question_id));
  const seedInEngine = [...seedRoots].every((r) => statique.roots.has(r));
  check("2 : les 197 racines du seed (S9-1) = racines dérivées du moteur", seedInEngine && seedRoots.size === 197);

  // ---- 6. Identité statique ↔ Supabase (clés dérivées) ----------------------
  stub.__resetDb();
  stub.__setAuthContext("user-1");
  stub.__setQuestions(makeRows());
  questionsSvc.resetQuestionsCache();
  const loaded = await questionsSvc.loadBatteries();
  const fromSupabase = coherence.expectedKeySetFromBatteries(loaded.batteries);
  const join = (s) => [...s].sort().join("|");
  check("6 : clés dérivées identiques statique ↔ Supabase (299)", loaded.batteries[0].source === "supabase" && join(fromSupabase.keys) === join(statique.keys));
  check("6 : racines identiques statique ↔ Supabase (197)", join(fromSupabase.roots) === join(statique.roots));

  // ---- 3. Round-trip complet : 299 clés écrites puis relues -----------------
  const attempt = await attemptsSvc.getOrCreateAttempt("user-1");
  const fullShape = fullResponsesShape(loaded.batteries);
  const saved = await responsesSvc.saveResponses(attempt.id, fullShape, { replace: true, markCompleted: true });
  check("3 : écriture des 299 clés via saveResponses OK", saved && saved.ok === true && stub.__db().assessment_responses.length === 299);
  const reread = await responsesSvc.listResponses(attempt.id);
  const rows = stub.__db().assessment_responses.map((r) => ({ question_id: r.question_id, answer: r.answer }));
  const report = coherence.checkResponsesCoherence(loaded.batteries, rows);
  check("3 : round-trip 299/299 cohérent (0 orpheline)", report.coherent === true && report.rows === 299 && report.orphans.length === 0);
  check("3 : répartition familles 178 mcq / 54 b7 / 67 b8", report.byFamily.mcq === 178 && report.byFamily.b7 === 54 && report.byFamily.b8 === 67);
  check("3 : 197 racines couvertes après round-trip complet", report.usedRoots === 197 && report.distinctKeys === 299);
  const rereadKeys = coherence.expectedKeySetFromBatteries(loaded.batteries);
  check("3 : clés relues (shapeFromRows) ⊆ clés attendues", Object.keys(reread.mcq).every((k) => rereadKeys.keys.has("mcq:" + k)) && Object.keys(reread.b7).every((c) => Object.keys(reread.b7[c]).every((d) => rereadKeys.keys.has(`b7:${c}:${d}`))) && Object.keys(reread.b8).every((i) => Object.keys(reread.b8[i]).every((f) => rereadKeys.keys.has(`b8:${i}:${f}`))));

  // ---- 7. Répartition par batterie et couverture B1→B8 ----------------------
  const perBattery = loaded.batteries.map((b) => b.items.length).join("/");
  check("7 : répartition items 32/28/30/28/32/28/9/10", perBattery === "32/28/30/28/32/28/9/10");
  const b7b = loaded.batteries.find((b) => b.type === "rubric");
  const b8b = loaded.batteries.find((b) => b.type === "coherence");
  const b7Keys = [...statique.keys].filter((k) => k.startsWith("b7:"));
  check("7 : B7 => 6 clés par cas (5 dims NST/PRO/PRI/GCH/VS + text)", b7Keys.length === b7b.items.length * 6 && ["b7:C1:NST", "b7:C1:VS", "b7:C1:text"].every((k) => statique.keys.has(k)));
  const firstSim = b8b.items[0];
  check("7 : B8 => watch + text dérivables par item", (firstSim.watch ?? []).every((f) => statique.keys.has(`b8:${firstSim.id}:${f}`)) && statique.keys.has(`b8:${firstSim.id}:text`));

  // ---- 4. Réponses partielles (cas réel : 10/197) ----------------------------
  stub.__resetDb();
  stub.__setAuthContext("user-1");
  stub.__setQuestions(makeRows());
  questionsSvc.resetQuestionsCache();
  const attempt2 = await attemptsSvc.getOrCreateAttempt("user-1");
  await responsesSvc.saveResponses(attempt2.id, { mcq: { Q1: "B" }, b7: { C1: { NST: 4, text: "x" } }, b8: {} }, { replace: true });
  const partialRows = stub.__db().assessment_responses.map((r) => ({ question_id: r.question_id, answer: r.answer }));
  const partialReport = coherence.checkResponsesCoherence(loaded.batteries, partialRows);
  check("4 : 3 réponses partielles => 0 orpheline, 2 racines couvertes", partialReport.coherent === true && partialReport.rows === 3 && partialReport.usedRoots === 2);
  check("4 : 296 clés attendues restantes (299 - 3)", partialReport.expectedKeys - partialReport.distinctKeys === 296);

  // ---- 5. Détection d'orphelines ---------------------------------------------
  const withOrphans = [...partialRows, { question_id: "mcq:Q999", answer: "A" }, { question_id: "b7:C1", answer: 3 }, { question_id: "legacy:old-key", answer: true }];
  const orphanReport = coherence.checkResponsesCoherence(loaded.batteries, withOrphans);
  check("5 : 3 orphelines détectées (hors dataset, mal formée, famille inconnue)", orphanReport.coherent === false && orphanReport.orphans.length === 3 && orphanReport.byFamily.unknown === 3);
  check("5 : raisons explicites pour chaque orpheline", orphanReport.orphans.every((o) => typeof o.reason === "string" && o.reason.length > 0));
  const cls = coherence.classifyResponseKey("b8:M1:fort");
  const clsBad = coherence.classifyResponseKey("");
  check("5 : classifyResponseKey => racine/suffixe corrects, clé vide rejetée", cls.ok && cls.family === "b8" && cls.root === "b8:M1" && cls.suffix === "fort" && clsBad.ok === false);

  // ---- 8. Garde-fou : le module ne touche à rien (pur, déterministe) ---------
  const before = JSON.stringify(stub.__db().assessment_responses);
  coherence.checkResponsesCoherence(loaded.batteries, stub.__db().assessment_responses);
  const after = JSON.stringify(stub.__db().assessment_responses);
  check("8 : checkResponsesCoherence est pur (aucune écriture base)", before === after);
} catch (e) {
  console.log("FAIL - exception: " + (e instanceof Error ? e.stack : JSON.stringify(e)));
  failures++;
} finally {
  await vite.close();
}

console.log(failures === 0 ? "\n=== TOUS LES TESTS PASSENT ===" : `\n=== ${failures} ECHEC(S) ===`);
process.exit(failures === 0 ? 0 : 1);
