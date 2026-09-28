// S9-3 : vérification de cohérence questions ↔ réponses — module PUR
// (aucun accès réseau/base : il ne fait que dériver et comparer des clés).
// Utilisé par :
//   - le harnais scripts/verify-p3s9-3.mjs (tests stub) ;
//   - le contrôle de production scripts/p3s9-3-prod-check.js (console
//     navigateur admin, lecture seule) qui l'importe depuis l'app elle-même
//     → la logique de vérification est EXACTEMENT celle de l'application.
//
// Clés attendues (IMMUABLES), dérivées des batteries actives :
//   mcq:<item.id>                     batteries QCM (types correct/weighted)
//   b7:<cas>:<dim> + b7:<cas>:text    rubric (dims fixes NST/PRO/PRI/GCH/VS)
//   b8:<item>:<champ watch> + :text   simulation intégrée
//
// Toute réponse persistée dont la clé n'est pas dérivable des questions
// actives est un ORPHELIN (réponse perdue pour le scoring).

const B7_DIMS = ["NST", "PRO", "PRI", "GCH", "VS"];

/**
 * Ensemble des clés de réponses attendues pour des batteries données.
 * Retourne { keys: Set<string>, roots: Set<string> } :
 *  - keys  = clés persistables (299 pour le dataset complet) ;
 *  - roots = clés racines de questions (197 : mcq:<id> / b7:<cas> / b8:<item>).
 */
export function expectedKeySetFromBatteries(batteries) {
  const keys = new Set();
  const roots = new Set();
  for (const b of batteries ?? []) {
    for (const it of b.items ?? []) {
      if (b.type === "correct" || b.type === "weighted") {
        const key = "mcq:" + it.id;
        keys.add(key);
        roots.add(key);
      } else if (b.type === "rubric") {
        const root = "b7:" + it.id;
        roots.add(root);
        B7_DIMS.forEach((d) => keys.add(`b7:${it.id}:${d}`));
        keys.add(`b7:${it.id}:text`);
      } else {
        // coherence : champs watch porteurs de clés + champ texte
        const root = "b8:" + it.id;
        roots.add(root);
        (it.watch ?? []).forEach((f) => keys.add(`b8:${it.id}:${f}`));
        keys.add(`b8:${it.id}:text`);
      }
    }
  }
  return { keys, roots };
}

/**
 * Classification stricte d'une clé de réponse persistée.
 * → { ok, family, root, suffix, reason } — aucune exception silencieuse :
 * toute clé mal formée ou de famille inconnue est signalée (ok=false).
 */
export function classifyResponseKey(questionId) {
  if (typeof questionId !== "string" || questionId.length === 0) {
    return { ok: false, family: null, root: null, suffix: null, reason: "clé vide" };
  }
  if (questionId.startsWith("mcq:")) {
    const id = questionId.slice("mcq:".length);
    if (!id) return { ok: false, family: "mcq", root: null, suffix: null, reason: "mcq sans identifiant" };
    return { ok: true, family: "mcq", root: questionId, suffix: null };
  }
  if (questionId.startsWith("b7:") || questionId.startsWith("b8:")) {
    const family = questionId.slice(0, 2);
    const rest = questionId.slice(family.length + 1);
    const sep = rest.lastIndexOf(":");
    if (sep <= 0) return { ok: false, family, root: null, suffix: null, reason: "suffixe manquant" };
    return {
      ok: true,
      family,
      root: `${family}:${rest.slice(0, sep)}`,
      suffix: rest.slice(sep + 1),
    };
  }
  return { ok: false, family: null, root: null, suffix: null, reason: "famille inconnue" };
}

/**
 * Vérification croisée complète :
 *  1) chaque réponse persistée (rows = lignes brutes assessment_responses)
 *     doit correspondre à une clé dérivable des questions actives ;
 *  2) toute question active doit produire au moins une clé attendue
 *     (couverture : roots derivés = questions actives).
 * Lecture seule — ne modifie rien, ne lève jamais.
 */
export function checkResponsesCoherence(batteries, rows) {
  const { keys, roots } = expectedKeySetFromBatteries(batteries);
  const orphans = [];
  const byFamily = { mcq: 0, b7: 0, b8: 0, unknown: 0 };
  const usedRoots = new Set();
  const seenKeys = new Set();

  for (const row of rows ?? []) {
    const qid = row?.question_id;
    seenKeys.add(qid);
    const c = classifyResponseKey(qid);
    if (!c.ok) {
      orphans.push({ question_id: qid, reason: c.reason });
      byFamily.unknown += 1;
      continue;
    }
    if (!keys.has(qid)) {
      orphans.push({ question_id: qid, reason: "clé non dérivable des questions actives" });
      byFamily.unknown += 1;
      continue;
    }
    byFamily[c.family] += 1;
    usedRoots.add(c.root);
  }

  return {
    expectedKeys: keys.size,
    expectedRoots: roots.size,
    rows: (rows ?? []).length,
    distinctKeys: seenKeys.size,
    byFamily,
    usedRoots: usedRoots.size,
    orphans,
    coherent: orphans.length === 0,
  };
}
