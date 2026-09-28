/* ============================================================================
   P3-S9-3 — Contrôle de cohérence questions ↔ réponses EN PRODUCTION
   ----------------------------------------------------------------------------
   MODE D'EMPLOI (100 % LECTURE SEULE — aucune écriture, aucune suppression) :
     1. Lancer l'app en dev :  pnpm dev --port 5350   (http://127.0.0.1:5350)
     2. Ouvrir http://127.0.0.1:5350 dans le navigateur et se connecter avec
        le compte Super Admin (la session Supabase de CETTE fenêtre est
        utilisée — RLS admin : lecture tentatives + réponses autorisée).
     3. Ouvrir la console DevTools (F12), coller TOUT ce fichier, Entrée.
     4. Lire le rapport : window.__P3S9_3_REPORT__ (+ console.table des
        orphelines éventuelles).

   Ce que fait le contrôle (aucun autre effet) :
     - charge les questions ACTIVES via loadBatteries() — le MÊME service que
       /test et le mode test (fallback statique signalé le cas échéant) ;
     - lit assessment_attempts + assessment_responses (SELECT uniquement) ;
     - croise chaque réponse persistée avec les clés dérivables des questions
       actives (logique importée de l'app : src/services/assessments/coherence.js,
       donc EXACTEMENT celle testée par scripts/verify-p3s9-3.mjs) ;
     - signale : orphelines (clé non dérivable / mal formée), réponses rattachées
       à une tentative inconnue ou d'un autre assessment, couverture racines.

   Critère de validation S9-3 : coherent === true (aucune réponse orpheline).
   ========================================================================== */
(async () => {
  const log = (...a) => console.log("%c[S9-3]", "font-weight:bold", ...a);
  try {
    log("Import des modules de l'application (dev server)…");
    const [{ checkResponsesCoherence, expectedKeySetFromBatteries }, questionsSvc, { supabase }] = await Promise.all([
      import("/src/services/assessments/coherence.js"),
      import("/src/services/assessments/questions.js"),
      import("/src/lib/supabaseClient.js"),
    ]);

    // 1) Questions actives (même source que /test). Lecture seule.
    const loaded = await questionsSvc.loadBatteries();
    const batteries = loaded.batteries;
    const totalItems = batteries.reduce((n, b) => n + b.items.length, 0);
    log(`Questions chargées : ${batteries.length} batteries, ${totalItems} items, source=${batteries[0]?.source}${loaded.fallback ? " (FALLBACK statique — voir warning console)" : ""}`);

    // 2) Tentatives + réponses persistées (SELECT uniquement).
    const [attRes, respRes] = await Promise.all([
      supabase.from("assessment_attempts").select("id, user_id, assessment_id"),
      supabase.from("assessment_responses").select("attempt_id, question_id, answer"),
    ]);
    if (attRes.error) throw attRes.error;
    if (respRes.error) throw respRes.error;
    const attempts = attRes.data ?? [];
    const knownAttempts = new Set(attempts.filter((a) => a.assessment_id === "ntc-assessment").map((a) => a.id));
    const rows = respRes.data ?? [];
    log(`Lectures OK : ${attempts.length} tentative(s), ${rows.length} réponse(s) persistée(s).`);

    // 3) Vérification croisée (module pur de l'app).
    const report = checkResponsesCoherence(batteries, rows);

    // 4) Réponses rattachées à une tentative inconnue / autre assessment.
    const detached = rows.filter((r) => !knownAttempts.has(r.attempt_id));

    // 5) Couverture des racines de questions (informationnel).
    const { roots } = expectedKeySetFromBatteries(batteries);
    const usedRoots = new Set();
    for (const r of rows) {
      const m = /^(mcq:[^:]+|b7:[^:]+:[^:]+|b8:[^:]+:[^:]+)$/.exec(r.question_id || "");
      if (!m) continue;
      const root = r.question_id.startsWith("mcq:") ? r.question_id : r.question_id.replace(/:[^:]+$/, "");
      if (roots.has(root)) usedRoots.add(root);
    }

    const summary = {
      assessment: "ntc-assessment",
      questions: { batteries: batteries.length, items: totalItems, source: batteries[0]?.source, fallback: Boolean(loaded.fallback) },
      expectedKeys: report.expectedKeys,
      persistedRows: report.rows,
      distinctKeys: report.distinctKeys,
      byFamily: report.byFamily,
      orphans: report.orphans,
      coherent: report.coherent && detached.length === 0,
      detachedRows: detached,
      rootsCovered: usedRoots.size,
      rootsTotal: roots.size,
      "read-only": true,
    };

    window.__P3S9_3_REPORT__ = summary;
    console.log("%c[S9-3] RAPPORT (window.__P3S9_3_REPORT__)", "font-weight:bold");
    console.table({
      "clés attendues": summary.expectedKeys,
      "réponses persistées": summary.persistedRows,
      "clés distinctes": summary.distinctKeys,
      "mcq / b7 / b8": `${summary.byFamily.mcq} / ${summary.byFamily.b7} / ${summary.byFamily.b8}`,
      "orphelines": summary.orphans.length,
      "lignes détachées": summary.detachedRows.length,
      "racines couvertes": `${summary.rootsCovered}/${summary.rootsTotal}`,
      "fallback questions": summary.questions.fallback,
    });
    if (summary.orphans.length > 0) {
      console.warn(`[S9-3] ${summary.orphans.length} réponse(s) orpheline(s) :`);
      console.table(summary.orphans);
    }
    if (summary.detachedRows.length > 0) {
      console.warn(`[S9-3] ${summary.detachedRows.length} réponse(s) rattachée(s) à une tentative inconnue/autre assessment :`);
      console.table(summary.detachedRows);
    }
    log(summary.coherent
      ? "✅ COHÉRENT : aucune réponse orpheline — chaque réponse persistée correspond à une question active."
      : "❌ INCOHÉRENT : voir les orphelines/détachées ci-dessus.");
  } catch (e) {
    console.error("[S9-3] Contrôle impossible (lecture seule, rien n'a été modifié) :", e);
    console.error("Vérifier : session admin active, app lancée sur ce port, RLS admin.");
  }
})();
