/* Tests S9-2 : service questions (Supabase + fallback statique).
   Scénarios :
   1. Dataset complet 197 valide  => batteries Supabase identiques au statique
      (contenu à l'octet près, ordre, source="supabase").
   2. Dataset vide                => fallback statique.
   3. Dataset partiel (196)       => fallback statique (jamais partiel).
   4. Erreur réseau simulée       => fallback statique.
   5. Contenu invalide (champ porteur de clé manquant : b8 sans watch) => fallback.
   6. Anonyme (RLS)               => 0 ligne => fallback.
   7. Doublon question_id         => fallback.
   8. Ordre rompu (display_order) => fallback.
   9. Cache de session : 2e appel sans relecture réseau.
   10. Non-régression : clés de réponses dérivables identiques statique/Supabase. */
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
    name: "p3s9-stub",
    enforce: "pre",
    resolveId(id) {
      if (id.includes("lib/supabaseClient.js")) return pathToFileURL(resolve("scripts/p3s8-supabase-stub.mjs")).href;
      return null;
    },
  }],
});

const questionsSvc = await vite.ssrLoadModule("/src/services/assessments/questions.js");
const data = await vite.ssrLoadModule("/src/data/index.js");

let failures = 0;
function check(label, cond) {
  console.log((cond ? "PASS" : "FAIL") + " - " + label);
  if (!cond) failures++;
}

// Génère les lignes Supabase à partir du JSON de contrôle S9-1 + src/data
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

// Compare les batteries Supabase au statique (contenu + ordre + structure)
function sameAsStatic(batteries) {
  if (batteries.length !== data.BATTERIES.length) return false;
  for (let i = 0; i < batteries.length; i++) {
    const s = data.BATTERIES[i], r = batteries[i];
    if (s.id !== r.id || s.type !== r.type || s.name !== r.name || s.axis !== r.axis) return false;
    if (r.source !== "supabase") return false;
    if (s.items.length !== r.items.length) return false;
    for (let j = 0; j < s.items.length; j++) {
      if (JSON.stringify(s.items[j]) !== JSON.stringify(r.items[j])) return false;
    }
  }
  return true;
}

function staticLike(batteries) {
  return batteries.length === data.BATTERIES.length &&
    batteries.every((b, i) => b.id === data.BATTERIES[i].id && b.source === "static" &&
      b.items.length === data.BATTERIES[i].items.length &&
      b.items.every((it, j) => JSON.stringify(it) === JSON.stringify(data.BATTERIES[i].items[j])));
}

try {
  // ---- 1. Dataset complet valide ------------------------------------------
  stub.__resetDb();
  stub.__setAuthContext("user-1");
  stub.__setQuestions(makeRows());
  questionsSvc.resetQuestionsCache();
  let res = await questionsSvc.loadBatteries();
  check("1 : dataset complet => source supabase", res.batteries[0].source === "supabase" && !res.fallback);
  check("1 : contenu identique au statique (byte à byte, ordre inclus)", sameAsStatic(res.batteries));
  const totalItems = res.batteries.reduce((n, b) => n + b.items.length, 0);
  check("1 : total items = 197", totalItems === 197);

  // Champs porteurs de clés présents dans le contenu servi
  const b8 = res.batteries.find((b) => b.type === "coherence");
  check("1 : items B8 portent watch (clés dérivables)", b8.items.every((it) => Array.isArray(it.watch)));

  // ---- 9. Cache de session -------------------------------------------------
  stub.__setQuestions([]); // vide la base : le 2e appel doit servir le cache
  let res2 = await questionsSvc.loadBatteries();
  check("9 : cache de session (2e appel sans relecture réseau)", res2.batteries[0].source === "supabase" && sameAsStatic(res2.batteries));
  questionsSvc.resetQuestionsCache();

  // ---- 2. Dataset vide -----------------------------------------------------
  stub.__setQuestions([]);
  res = await questionsSvc.loadBatteries();
  check("2 : dataset vide => fallback statique complet", staticLike(res.batteries) && res.fallback === true);

  // ---- 3. Dataset partiel (196 : une question retirée) ---------------------
  const partial = makeRows();
  partial.splice(50, 1);
  stub.__setQuestions(partial);
  questionsSvc.resetQuestionsCache();
  res = await questionsSvc.loadBatteries();
  check("3 : dataset partiel (196) => fallback statique", staticLike(res.batteries) && res.fallback === true);

  // ---- 4. Erreur réseau simulée --------------------------------------------
  stub.__setQuestionsError("boom");
  questionsSvc.resetQuestionsCache();
  res = await questionsSvc.loadBatteries();
  check("4 : erreur réseau => fallback statique", staticLike(res.batteries) && res.fallback === true);
  stub.__setQuestionsError(null);

  // ---- 5. Contenu invalide (b8 sans watch => clés non dérivables) ----------
  const invalid = makeRows();
  const badB8 = invalid.find((r) => r.question_id === "b8:M1");
  badB8.content = { ...badB8.content, watch: undefined };
  stub.__setQuestions(invalid);
  questionsSvc.resetQuestionsCache();
  res = await questionsSvc.loadBatteries();
  check("5 : b8 sans watch => fallback statique (anti-orphelin)", staticLike(res.batteries) && res.fallback === true);

  // ---- 6. Anonyme (RLS => 0 ligne) -----------------------------------------
  stub.__setAuthContext(null);
  stub.__setQuestions(makeRows());
  questionsSvc.resetQuestionsCache();
  res = await questionsSvc.loadBatteries();
  check("6 : anonyme (RLS) => fallback statique", staticLike(res.batteries) && res.fallback === true);
  stub.__setAuthContext("user-1");

  // ---- 7. Doublon question_id ----------------------------------------------
  const dup = makeRows();
  dup.push({ ...dup[0], display_order: 198 });
  stub.__setQuestions(dup);
  questionsSvc.resetQuestionsCache();
  res = await questionsSvc.loadBatteries();
  check("7 : doublon question_id => fallback statique", staticLike(res.batteries) && res.fallback === true);

  // ---- 8. Ordre rompu ------------------------------------------------------
  const shuffled = makeRows();
  const tmp = shuffled[10].display_order;
  shuffled[10].display_order = shuffled[11].display_order;
  shuffled[11].display_order = tmp;
  stub.__setQuestions(shuffled);
  questionsSvc.resetQuestionsCache();
  res = await questionsSvc.loadBatteries();
  check("8 : ordre rompu => fallback statique", staticLike(res.batteries) && res.fallback === true);

  // ---- 10. Clés de réponses dérivables identiques (anti-orphelin) ----------
  stub.__setQuestions(makeRows());
  questionsSvc.resetQuestionsCache();
  res = await questionsSvc.loadBatteries();
  const B7_DIMS = ["NST", "PRO", "PRI", "GCH", "VS"];
  function deriveKeys(batteries) {
    const keys = [];
    for (const b of batteries) {
      for (const it of b.items) {
        if (b.type === "correct" || b.type === "weighted") keys.push("mcq:" + it.id);
        else if (b.type === "rubric") B7_DIMS.forEach((d) => keys.push(`b7:${it.id}:${d}`)), keys.push(`b7:${it.id}:text`);
        else (it.watch || []).forEach((f) => keys.push(`b8:${it.id}:${f}`)), keys.push(`b8:${it.id}:text`);
      }
    }
    return keys.sort().join("|");
  }
  check("10 : clés de réponses dérivables identiques statique/Supabase", deriveKeys(res.batteries) === deriveKeys(data.BATTERIES));

  // ---- 11. Fallback statique : copie défensive (pas de référence partagée) --
  stub.__setQuestionsError("force fallback"); // forcer le chemin fallback
  questionsSvc.resetQuestionsCache();
  res = await questionsSvc.loadBatteries();
  res.batteries[0].items[0].text = "MUTED";
  check("11 : fallback = copie défensive (statique intact)", data.BATTERIES[0].items[0].text !== "MUTED");
  stub.__setQuestionsError(null);
} catch (e) {
  console.log("FAIL - exception: " + (e instanceof Error ? e.stack : JSON.stringify(e)));
  failures++;
} finally {
  await vite.close();
}

console.log(failures === 0 ? "\n=== TOUS LES TESTS PASSENT ===" : `\n=== ${failures} ECHEC(S) ===`);
process.exit(failures === 0 ? 0 : 1);
