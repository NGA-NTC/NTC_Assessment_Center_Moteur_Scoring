/* Tests comportementaux P3-S8 : exécutent les VRAIS services
   (src/services/assessments/attempts.js + responses.js) avec un stub Supabase
   fidèle (query builder + sémantique RLS). Scénarios A à I de la spéc. */
import { createServer } from "vite";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const stub = await import("./p3s8-supabase-stub.mjs");

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  plugins: [{
    name: "p3s8-test-stub",
    enforce: "pre",
    resolveId(id) {
      if (id.includes("lib/supabaseClient.js")) {
        return pathToFileURL(resolve("scripts/p3s8-supabase-stub.mjs")).href;
      }
      return null;
    },
  }],
});

const attempts = await vite.ssrLoadModule("/src/services/assessments/attempts.js");
const responses = await vite.ssrLoadModule("/src/services/assessments/responses.js");
const candidatesMod = await vite.ssrLoadModule("/src/lib/candidates.js");

let failures = 0;
function check(label, cond) {
  console.log((cond ? "PASS" : "FAIL") + " - " + label);
  if (!cond) failures++;
}

try {
  // ---- A. Nouveau compte → 0 réponse → visible dans Résultats à 0 % -------
  stub.__resetDb();
  stub.__setAuthContext("user-1");
  const att = await attempts.getOrCreateAttempt("user-1");
  check("A : tentative créée (get-or-create)", !!att && att.userId === "user-1");
  const remote = await responses.listResponses(att.id);
  const emptyProgress = { answered: 0, total: 84, pct: 0 };
  const supabaseCandidates = [{
    kind: "supabase", id: "supabase:user-1", label: "Alice Martin", badge: "Compte",
    badgeTone: "compte", meta: "test", responses: remote, progress: emptyProgress,
    sc: { axes: {}, roles: [] }, search: "Alice", email: "user1@test.dev",
    data: { userId: "user-1", email: "user1@test.dev", createdAt: "2026-09-01T10:00:00Z", attempt: att },
  }];
  let list = candidatesMod.buildCandidates({ supabaseCandidates, accounts: [], staticImports: [], runtimeImports: [], hiddenStatic: [] });
  const c0 = list.find((c) => c.id === "supabase:user-1");
  check("A : candidat visible avec 0 réponse à 0%", !!c0 && c0.progress.pct === 0 && c0.progress.answered === 0);

  // ---- B. Répondre Q1/Q2/Q3 → quitter → revenir → restaurées --------------
  await responses.saveResponses(att.id, { mcq: { Q1: "B", Q2: "D", Q3: "A" }, b7: {}, b8: {} }, { currentQuestionId: "BATTERY1" });
  const reloaded = await responses.listResponses(att.id);
  check("B : Q1 = B restaurée", reloaded.mcq.Q1 === "B");
  check("B : Q2 = D restaurée", reloaded.mcq.Q2 === "D");
  check("B : Q3 = A restaurée", reloaded.mcq.Q3 === "A");

  // ---- C. Refresh navigateur → réponses toujours présentes ----------------
  // (le reload réexécute listResponses — équivalent d'un refresh)
  const reloaded2 = await responses.listResponses(att.id);
  check("C : après refresh Q1/Q2/Q3 toujours présentes", reloaded2.mcq.Q1 === "B" && reloaded2.mcq.Q2 === "D" && reloaded2.mcq.Q3 === "A");

  // ---- D. Compte existant → nouveau test → sauvegarde correcte ------------
  stub.__setAuthContext("user-2");
  const att2 = await attempts.getOrCreateAttempt("user-2");
  check("D : compte existant peut commencer un test", !!att2 && att2.userId === "user-2");
  await responses.saveResponses(att2.id, { mcq: { Q1: "C" }, b7: {}, b8: {} }, {});
  const d1 = await responses.listResponses(att2.id);
  check("D : sauvegarde correcte pour compte existant", d1.mcq.Q1 === "C");

  // ---- E. Modifier une réponse → upsert → une seule ligne par question ----
  await responses.saveResponses(att2.id, { mcq: { Q1: "A" }, b7: {}, b8: {} }, {});
  const e1 = await responses.listResponses(att2.id);
  check("E : réponse modifiée (upsert)", e1.mcq.Q1 === "A");
  const rowsForAtt2 = stub.__db().assessment_responses.filter((r) => r.attempt_id === att2.id && r.question_id === "mcq:Q1");
  check("E : une seule ligne par (attempt, question)", rowsForAtt2.length === 1);

  // ---- F. Deux assessments pour le même user → deux tentatives ------------
  stub.__setAuthContext("user-2");
  const att2b = await attempts.getOrCreateAttempt("user-2", "ntc-assessment-bis");
  check("F : deux tentatives distinctes pour le même user", att2b.id !== att2.id);
  check("F : get-or-create est idempotent", (await attempts.getOrCreateAttempt("user-2")).id === att2.id);

  // ---- G. current_question_id → reprise sur la dernière question ----------
  // (recontexte : l'utilisateur propriétaire reprend son test)
  stub.__setAuthContext("user-1");
  await attempts.updateAttemptProgress(att.id, { currentQuestionId: "BATTERY3" });
  const attAfter = await attempts.getOrCreateAttempt("user-1");
  check("G : position sauvegardée puis restaurée", attAfter.currentQuestionId === "BATTERY3");

  // ---- H. Résultats : progression mise à jour après réponses --------------
  const shape = await responses.listResponses(att.id);
  const answeredCount = Object.keys(shape.mcq).length;
  check("H : 3 réponses comptées depuis Supabase", answeredCount === 3);
  const supabaseCandidates2 = [{
    kind: "supabase", id: "supabase:user-1", label: "Alice Martin", badge: "Compte",
    badgeTone: "compte", meta: "test", responses: shape,
    progress: { answered: answeredCount, total: 84, pct: Math.round((100 * answeredCount) / 84) },
    sc: { axes: {}, roles: [] },
    search: "Alice", email: "user1@test.dev",
    data: { userId: "user-1", email: "user1@test.dev", createdAt: "2026-09-01T10:00:00Z", attempt: attAfter },
  }];
  list = candidatesMod.buildCandidates({ supabaseCandidates: supabaseCandidates2, accounts: [], staticImports: [], runtimeImports: [], hiddenStatic: [] });
  const c1 = list.find((c) => c.id === "supabase:user-1");
  check("H : progression reflétée dans Résultats", !!c1 && c1.progress.answered === 3 && c1.responses.mcq.Q1 === "B");

  // ---- I. RLS : un candidat ne voit pas les réponses d'un autre -----------
  stub.__setAuthContext("user-2");
  const crossShape = await responses.listResponses(att.id); // att appartient à user-1
  check("I : user-2 ne voit pas les réponses de user-1 (RLS)", Object.keys(crossShape.mcq).length === 0);
  const crossSave = await responses.saveResponses(att.id, { mcq: { Q99: "X" }, b7: {}, b8: {} }, {});
  check("I : écriture croisée refusée par la RLS", crossSave.ok === false);
  // Admin (lecture seule) : voit tout, n'écrit pas
  stub.__setAuthContext("admin-1", true);
  const adminShape = await responses.listResponses(att.id);
  check("I : admin lit les réponses du candidat", adminShape.mcq.Q1 === "B");
  const adminWrite = await responses.saveResponses(att.id, { mcq: { Q98: "Z" }, b7: {}, b8: {} }, {});
  check("I : admin ne peut pas écrire les réponses (RLS)", adminWrite.ok === false);

  // ---- Suppression de tentative (cascade réponses) ------------------------
  stub.__setAuthContext("user-1");
  await attempts.deleteAttempt(att.id);
  const rowsAfter = stub.__db().assessment_responses.filter((r) => r.attempt_id === att.id);
  check("Cascade : suppression tentative → réponses supprimées", rowsAfter.length === 0);
} catch (e) {
  console.log("FAIL - exception: " + (e instanceof Error ? e.stack : JSON.stringify(e)));
  failures++;
} finally {
  await vite.close();
}

console.log(failures === 0 ? "\n=== TOUS LES TESTS PASSENT ===" : `\n=== ${failures} ECHEC(S) ===`);
process.exit(failures === 0 ? 0 : 1);
