import { supabase } from "../../lib/supabaseClient.js";
import { updateAttemptProgress } from "./attempts.js";

// Préfixes de question_id stockés dans assessment_responses :
//   mcq:<clé>            → réponses QCM (batteries 1-6)
//   b7:<caseId>:<dimKey> → notations rubric
//   b8:<itemId>:<dimKey> → simulation intégrée (les valeurs texte de b8 sont
//                          stockées sous b8:<itemId>:__text)
// Le format interne applicatif reste { mcq:{}, b7:{}, b8:{} } — inchangé
// (questions, scoring et calculs ne sont PAS migrés en P3-S8).

const MCQ = "mcq:";
const B7 = "b7:";
const B8 = "b8:";

function toRow(attemptId, questionId, answer) {
  return { attempt_id: attemptId, question_id: questionId, answer };
}

function rowsFromShape(attemptId, responses) {
  const rows = [];
  const mcq = responses.mcq || {};
  for (const [key, value] of Object.entries(mcq)) {
    if (value != null) rows.push(toRow(attemptId, MCQ + key, value));
  }
  const b7 = responses.b7 || {};
  for (const [caseId, dims] of Object.entries(b7)) {
    if (!dims || typeof dims !== "object") continue;
    for (const [dimKey, value] of Object.entries(dims)) {
      if (value != null) rows.push(toRow(attemptId, `${B7}${caseId}:${dimKey}`, value));
    }
  }
  const b8 = responses.b8 || {};
  for (const [itemId, data] of Object.entries(b8)) {
    if (!data || typeof data !== "object") continue;
    for (const [key, value] of Object.entries(data)) {
      if (value == null) continue;
      rows.push(toRow(attemptId, `${B8}${itemId}:${key}`, value));
    }
  }
  return rows;
}

function shapeFromRows(rows) {
  const shape = { mcq: {}, b7: {}, b8: {} };
  (rows ?? []).forEach((row) => {
    const qid = row.question_id;
    const answer = row.answer;
    if (qid.startsWith(MCQ)) {
      shape.mcq[qid.slice(MCQ.length)] = answer;
    } else if (qid.startsWith(B7)) {
      const rest = qid.slice(B7.length);
      const sep = rest.lastIndexOf(":");
      if (sep <= 0) return;
      const caseId = rest.slice(0, sep);
      const dimKey = rest.slice(sep + 1);
      shape.b7[caseId] = shape.b7[caseId] || {};
      shape.b7[caseId][dimKey] = answer;
    } else if (qid.startsWith(B8)) {
      const rest = qid.slice(B8.length);
      const sep = rest.lastIndexOf(":");
      if (sep <= 0) return;
      const itemId = rest.slice(0, sep);
      const key = rest.slice(sep + 1);
      shape.b8[itemId] = shape.b8[itemId] || {};
      shape.b8[itemId][key] = answer;
    }
  });
  return shape;
}

function isEmptyShape(responses) {
  const r = responses || {};
  return (
    Object.keys(r.mcq || {}).length === 0 &&
    Object.keys(r.b7 || {}).length === 0 &&
    Object.keys(r.b8 || {}).length === 0
  );
}

/** Différence utile : entrées à écrire + clés devenues vides à supprimer. */
function diffShapes(current, next) {
  const changed = [];
  const emptied = [];
  const keys = new Set([
    ...Object.keys(current.mcq || {}),
    ...Object.keys(next.mcq || {}),
  ]);
  keys.forEach((key) => {
    const before = (current.mcq || {})[key];
    const after = (next.mcq || {})[key];
    if (after == null || after === "") {
      if (before != null && before !== "") emptied.push(MCQ + key);
    } else if (before !== after) {
      changed.push(toRow(null, MCQ + key, after));
    }
  });

  const cases = new Set([
    ...Object.keys(current.b7 || {}),
    ...Object.keys(next.b7 || {}),
  ]);
  cases.forEach((caseId) => {
    const dims = new Set([
      ...Object.keys((current.b7 || {})[caseId] || {}),
      ...Object.keys((next.b7 || {})[caseId] || {}),
    ]);
    dims.forEach((dimKey) => {
      const before = ((current.b7 || {})[caseId] || {})[dimKey];
      const after = ((next.b7 || {})[caseId] || {})[dimKey];
      if (after == null) {
        if (before != null) emptied.push(`${B7}${caseId}:${dimKey}`);
      } else if (before !== after) {
        changed.push(toRow(null, `${B7}${caseId}:${dimKey}`, after));
      }
    });
  });

  const items = new Set([
    ...Object.keys(current.b8 || {}),
    ...Object.keys(next.b8 || {}),
  ]);
  items.forEach((itemId) => {
    const fields = new Set([
      ...Object.keys((current.b8 || {})[itemId] || {}),
      ...Object.keys((next.b8 || {})[itemId] || {}),
    ]);
    fields.forEach((key) => {
      const before = ((current.b8 || {})[itemId] || {})[key];
      const after = ((next.b8 || {})[itemId] || {})[key];
      if (after == null || after === "") {
        if (before != null && before !== "") emptied.push(`${B8}${itemId}:${key}`);
      } else if (before !== after) {
        changed.push(toRow(null, `${B8}${itemId}:${key}`, after));
      }
    });
  });

  return { changed, emptied };
}

/** Chargement des réponses persistées d'une tentative → { mcq, b7, b8 }. */
export async function listResponses(attemptId) {
  const { data, error } = await supabase
    .from("assessment_responses")
    .select("question_id, answer")
    .eq("attempt_id", attemptId);

  if (error) throw error;
  return shapeFromRows(data);
}

/**
 * Sauvegarde incrémentale : upsert des entrées modifiées (une seule ligne par
 * (attempt_id, question_id) grâce à la contrainte unique), suppression des
 * clés vidées, puis mise à jour de la tentative (position, statut).
 * `replace` supprime d'abord toutes les lignes de la tentative (import /
 * backfill d'un jeu complet), `markCompleted` passe la tentative en terminé.
 */
export async function saveResponses(attemptId, responses, options = {}) {
  const { replace = false, markCompleted = false, currentQuestionId, previous } = options;

  try {
    if (replace) {
      const { error: delError } = await supabase
        .from("assessment_responses")
        .delete()
        .eq("attempt_id", attemptId);
      if (delError) throw delError;

      const rows = rowsFromShape(attemptId, responses);
      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from("assessment_responses")
          .upsert(rows, { onConflict: "attempt_id,question_id" });
        if (upsertError) throw upsertError;
      }
    } else {
      const { changed, emptied } = diffShapes(previous || {}, responses || {});
      if (emptied.length > 0) {
        const { error: delError } = await supabase
          .from("assessment_responses")
          .delete()
          .eq("attempt_id", attemptId)
          .in("question_id", emptied);
        if (delError) throw delError;
      }
      if (changed.length > 0) {
        const rows = changed.map((r) => ({ ...r, attempt_id: attemptId }));
        const { error: upsertError } = await supabase
          .from("assessment_responses")
          .upsert(rows, { onConflict: "attempt_id,question_id" });
        if (upsertError) throw upsertError;
      }
    }

    await updateAttemptProgress(attemptId, {
      currentQuestionId,
      ...(markCompleted ? { status: "completed" } : {}),
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Remplace intégralement les réponses d'une tentative (admin : mise à jour
 * d'un candidat depuis un JSON ; ou réinitialisation). Tente de créer la
 * tentative si absente — nécessite d'appeler getOrCreateAttempt avant.
 */
export async function replaceAttemptResponses(attemptId, responses, markCompleted = false) {
  return saveResponses(attemptId, responses, { replace: true, markCompleted });
}

export { isEmptyShape };
