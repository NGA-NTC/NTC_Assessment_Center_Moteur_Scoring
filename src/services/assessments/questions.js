import { supabase } from "../../lib/supabaseClient.js";
import { BATTERIES as STATIC_BATTERIES } from "../../data/index.js";

// S9-2 : les questions vivent dans Supabase (table assessment_questions,
// seedée depuis src/data en S9-1). Le dataset statique reste le FALLBACK
// obligatoire : indisponibilité, erreur, dataset vide/partiel/invalide =>
// retour au statique complet (jamais un dataset partiel).
// Les métadonnées de batterie (nom, type, axe) restent côté client (data/)
// : seule la SOURCE DU CONTENU des items est migrée — le moteur, les types
// de batteries et le scoring ne changent pas.

const ASSESSMENT_ID = "ntc-assessment";

// Total attendu = total statique (197). Tout écart => fallback.
const EXPECTED_TOTAL = STATIC_BATTERIES.reduce((n, b) => n + b.items.length, 0);

// Champs « porteurs de clés » : leur absence rend les clés de réponses
// non dérivables (risque d'orphelin) => dataset rejeté si manquant.
function hasKeyBearingFields(item, batteryType) {
  if (!item || typeof item !== "object") return false;
  if (batteryType === "correct" || batteryType === "weighted") return typeof item.id === "string" && item.id.length > 0;
  if (batteryType === "rubric") return typeof item.id === "string" && item.id.length > 0;
  return typeof item.id === "string" && item.id.length > 0 && Array.isArray(item.watch);
}

function buildStaticBatteries() {
  return STATIC_BATTERIES.map((b) => ({
    ...b,
    items: b.items.map((it) => ({ ...it })),
    source: "static",
  }));
}

/**
 * Reconstitue les batteries depuis les lignes Supabase.
 * Retourne null si le dataset est vide/partiel/invalide (=> fallback).
 * Règles de validation :
 *  - 1 ligne par question (item), exactement le total statique (197) ;
 *  - chaque (battery_id, question_id) statique présent, aucun supplément ;
 *  - content = objet item avec les champs porteurs de clés ;
 *  - ordre strictement croissant par batterie (display_order global seedé 1→197).
 */
function buildBatteriesFromRows(rows) {
  if (!Array.isArray(rows) || rows.length !== EXPECTED_TOTAL) return null;

  const byQuestionId = new Map();
  for (const row of rows) {
    if (!row || row.assessment_id !== ASSESSMENT_ID) return null;
    if (row.is_active !== true) return null;
    if (typeof row.question_id !== "string" || !row.question_id) return null;
    if (!Number.isInteger(row.battery_id)) return null;
    if (!Number.isInteger(row.display_order)) return null;
    const content = row.content;
    if (!content || typeof content !== "object" || Array.isArray(content)) return null;
    if (byQuestionId.has(row.question_id)) return null; // doublon
    byQuestionId.set(row.question_id, row);
  }

  const batteries = [];
  let expectedOrder = 1; // display_order global seedé (1 → 197, sans trou)
  for (const staticBattery of STATIC_BATTERIES) {
    const items = [];
    for (const staticItem of staticBattery.items) {
      // Clé racine de persistance (S9-1) : mcq:* / b7:* / b8:*
      const rootPrefix =
        staticBattery.type === "correct" || staticBattery.type === "weighted"
          ? "mcq:"
          : staticBattery.type === "rubric"
            ? "b7:"
            : "b8:";
      const questionId = rootPrefix + staticItem.id;
      const row = byQuestionId.get(questionId);
      if (!row) return null; // question manquante
      if (row.battery_id !== staticBattery.id) return null; // question mal rangée
      if (row.display_order !== expectedOrder) return null; // ordre rompu
      expectedOrder += 1;
      if (!hasKeyBearingFields(row.content, staticBattery.type)) return null;
      // Le content seedé EST l'objet item statique (S9-1) : on l'utilise tel quel.
      items.push(row.content);
      byQuestionId.delete(questionId);
    }
    batteries.push({
      ...staticBattery,
      items,
      source: "supabase",
    });
  }
  if (byQuestionId.size !== 0) return null; // questions supplémentaires
  return batteries;
}

let cache = null; // cache mémoire de session { batteries, loadedAt }

/**
 * Retourne les batteries (contenu des items) depuis Supabase si disponible
 * et valide, sinon le fallback statique complet. Ne lève jamais : le
 * questionnaire doit toujours pouvoir s'afficher.
 */
export async function loadBatteries() {
  if (cache) return cache;
  try {
    const { data, error } = await supabase
      .from("assessment_questions")
      .select("assessment_id, battery_id, question_id, content, display_order, is_active")
      .eq("assessment_id", ASSESSMENT_ID)
      .order("display_order", { ascending: true });

    if (error) throw error;
    const batteries = buildBatteriesFromRows(data);
    if (!batteries) throw new Error("dataset assessment_questions invalide ou partiel");
    cache = { batteries, loadedAt: new Date().toISOString() };
  } catch (e) {
    console.warn("Questions Supabase indisponibles — fallback statique :", e?.message || e);
    cache = { batteries: buildStaticBatteries(), loadedAt: new Date().toISOString(), fallback: true };
  }
  return cache;
}

/** Réinitialise le cache (tests). */
export function resetQuestionsCache() {
  cache = null;
}

/** Exposé pour les tests de cohérence S9-3. */
export { EXPECTED_TOTAL, buildBatteriesFromRows, buildStaticBatteries };
