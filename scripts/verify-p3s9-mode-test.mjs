/* Tests S9-2 : relecture « Voir les réponses (mode test) ».
   Vérifie la chaîne Supabase complète via le service modeTest + le rendu
   lecture seule (ResponsesReview), avec le stub RLS-fidèle :
   1. supabase:<user_id> + réponses persistées => réponses chargées en base
   2. Rendu lecture seule : option QCM sélectionnée, note B7, intensité B8
   3. Réponses partielles (2/197) : les 195 autres restent « non répondues »
   4. Aucune localStorage utilisée (mode test 100 % base)
   5. user_id inconnu => page lisible « aucune tentative », sans crash
   6. Anonyme (RLS) => erreur maîtrisée (pas de fuite de données)
   7. B1 → B8 : structure des batteries servies (types, items, watch B8) */
import { createServer } from "vite";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stub = await import("./p3s8-supabase-stub.mjs");

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  plugins: [{
    name: "p3s9-modetest-stub",
    enforce: "pre",
    resolveId(id) {
      if (id.includes("lib/supabaseClient.js")) return pathToFileURL(resolve("scripts/p3s8-supabase-stub.mjs")).href;
      return null;
    },
  }],
});

const modeTest = await vite.ssrLoadModule("/src/services/assessments/modeTest.js");
const questionsSvc = await vite.ssrLoadModule("/src/services/assessments/questions.js");
const attemptsSvc = await vite.ssrLoadModule("/src/services/assessments/attempts.js");
const responsesSvc = await vite.ssrLoadModule("/src/services/assessments/responses.js");
const scoring = await vite.ssrLoadModule("/src/lib/scoring.js");
const Review = (await vite.ssrLoadModule("/src/components/question/ResponsesReview.jsx")).default;
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

try {
  // ---- Jeu d'essai : admin, questions complètes, candidat partiel ----------
  stub.__resetDb();
  stub.__setAuthContext("admin-1", true);
  stub.__setQuestions(makeRows());
  questionsSvc.resetQuestionsCache();

  // Le candidat "user-1" répond à 2 questions (comme l'autosave P3-S8) :
  //   - un QCM B1 (Q1 => B)
  //   - une notation rubric B7 (C1 => NST=4 + texte)
  stub.__setAuthContext("user-1");
  const attempt = await attemptsSvc.getOrCreateAttempt("user-1");
  const partial = { mcq: { Q1: "B" }, b7: { C1: { NST: 4, text: "Il manque de la preparation." } }, b8: {} };
  const saved = await responsesSvc.saveResponses(attempt.id, partial, { replace: true });
  check("setup : sauvegarde candidat OK", saved && saved.ok === true);
  stub.__setAuthContext("admin-1", true);

  // ---- 1. Chargement via la chaîne mode test -------------------------------
  const c1 = await modeTest.loadModeTestCandidate("supabase:user-1");
  check("1 : kind=supabase, sans erreur", c1 && c1.kind === "supabase" && !c1.error);
  check("1 : label depuis le profil (RPC admin_get_users)", c1.label === "Alice Martin");
  check("1 : tentative retrouvee par user_id", c1.attempt && c1.attempt.userId === "user-1");
  check("1 : reponses depuis assessment_responses", c1.responses.mcq.Q1 === "B" && c1.responses.b7.C1.NST === 4 && c1.responses.b7.C1.text === "Il manque de la preparation.");

  // Questions : MEME source que /test (assessment_questions via loadBatteries)
  check("1 : batteries servies depuis Supabase (source=supabase, 8 batteries)", c1.batteries.length === 8 && c1.batteries.every((b) => b.source === "supabase"));
  check("1 : total items = 197 (meme dataset que /test)", c1.batteries.reduce((n, b) => n + b.items.length, 0) === 197);
  check("1 : pas de fallback questions", c1.fallback === false);

  // Progression partielle : 2/197 (les 195 autres => non répondues)
  const prog = scoring.accountProgress(c1.responses);
  check("3 : progression partielle 2/197", prog.answered === 2 && prog.total === 197);

  // ---- 2. Rendu lecture seule (mêmes composants que le candidat) -----------
  const html = renderToStaticMarkup(
    React.createElement(Review, {
      responses: c1.responses,
      batteryId: 1,
      batteries: c1.batteries,
    })
  );
  check("2 : B1 rendue avec l'énoncé Q1 (source Supabase)", html.includes("3, 6, 11, 18, 27"));
  check("2 : Q1 => option B (« 38 ») affichée comme sélectionnée", html.includes(">38</span>") && (html.match(/Option sélectionnée/g) || []).length === 1);

  const htmlB7 = renderToStaticMarkup(
    React.createElement(Review, { responses: c1.responses, batteryId: 7, batteries: c1.batteries })
  );
  check("2 : C1 => texte affiché + note NST=4 (1 seule note attribuée)", htmlB7.includes("Il manque de la preparation.") && (htmlB7.match(/— note attribuée/g) || []).length === 1);
  check("2 : C2→C9 non notés (8 x « Aucune note attribuée. »)", (htmlB7.match(/Aucune note attribuée\./g) || []).length === 8);

  // ---- 3. Batteries non répondues (ex. B8) : tout « non répondu » ----------
  const htmlB8 = renderToStaticMarkup(
    React.createElement(Review, { responses: c1.responses, batteryId: 8, batteries: c1.batteries })
  );
  check("3 : B8 non repondue => 10 x « Aucune intensité observée. »", (htmlB8.match(/Aucune intensité observée\./g) || []).length === 10);
  const htmlB2 = renderToStaticMarkup(
    React.createElement(Review, { responses: c1.responses, batteryId: 2, batteries: c1.batteries })
  );
  check("3 : B2 non repondue => « Aucune réponse sélectionnée. » présent", htmlB2.includes("Aucune réponse sélectionnée."));

  // ---- 4. Aucune localStorage utilisée -------------------------------------
  check("4 : environnement SSR sans localStorage (navigateur vierge)", typeof localStorage === "undefined");
  // (toutes les étapes ci-dessus ont tourné dans cet environnement : la chaîne
  // supabase: n'a jamais tenté d'y accéder, sinon elle aurait levé)

  // ---- 5. user_id inconnu : page lisible, sans crash -----------------------
  const c2 = await modeTest.loadModeTestCandidate("supabase:ghost-123");
  check("5 : user inconnu => aucune tentative, réponses vides, batteries servies", c2 && !c2.error && c2.attempt === null && c2.responses && Object.keys(c2.responses.mcq).length === 0 && c2.batteries.length === 8);

  // ---- 6. Anonyme (RLS) : aucune donnée ne fuit -----------------------------
  // RLS => listAllAttempts renvoie 0 ligne : la page affiche « Aucune
  // tentative » avec des réponses vides — jamais les données du candidat.
  stub.__setAuthContext(null, false);
  const c3 = await modeTest.loadModeTestCandidate("supabase:user-1");
  check("6 : anonyme => aucune tentative, réponses vides (pas de fuite RLS)", c3 && !c3.error && c3.attempt === null && Object.keys(c3.responses.mcq).length === 0 && Object.keys(c3.responses.b7).length === 0);
  stub.__setAuthContext("admin-1", true);

  // ---- 7. B1 → B8 : structure des batteries servies ------------------------
  const types = c1.batteries.map((b) => b.type).join(",");
  check("7 : types B1→B8 (QCM/rubric/coherence)", types === ["correct","weighted","weighted","weighted","weighted","weighted","rubric","coherence"].join(","));
  const b7 = c1.batteries.find((b) => b.type === "rubric");
  const b8 = c1.batteries.find((b) => b.type === "coherence");
  check("7 : B7 items id/text ; B8 items watch (clés dérivables)", b7.items.every((it) => it.id && it.text) && b8.items.every((it) => Array.isArray(it.watch) && it.watch.length > 0));

  // ---- 8. Format legacy sans localStorage : pas de crash -------------------
  const c4 = await modeTest.loadModeTestCandidate("acct:legacy@test.dev");
  check("8 : legacy acct: sans localStorage => message maitrise (pas de crash)", c4 && typeof c4.error === "string");
} catch (e) {
  console.log("FAIL - exception: " + (e instanceof Error ? e.stack : JSON.stringify(e)));
  failures++;
} finally {
  await vite.close();
}

console.log(failures === 0 ? "\n=== TOUS LES TESTS PASSENT ===" : `\n=== ${failures} ECHEC(S) ===`);
process.exit(failures === 0 ? 0 : 1);
