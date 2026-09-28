import { supabase } from "../../lib/supabaseClient.js";

// Identifiant de l'assessment courant (questionnaire NTC complet).
// Une tentative est créée par couple (user_id, assessment_id).
export const ASSESSMENT_ID = "ntc-assessment";

function normalizeAttempt(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    assessmentId: row.assessment_id,
    status: row.status,
    currentQuestionId: row.current_question_id ?? null,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    completedAt: row.completed_at ?? null,
  };
}

/**
 * Cherche la tentative (user_id, assessment_id). La crée si absente.
 * Ne jamais conditionner à la création récente du compte : un compte
 * existant doit pouvoir commencer (ou reprendre) n'importe quel test.
 */
export async function getOrCreateAttempt(userId, assessmentId = ASSESSMENT_ID) {
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("assessment_id", assessmentId)
    .maybeSingle();

  if (error) throw error;
  if (data) return normalizeAttempt(data);

  const insert = { user_id: userId, assessment_id: assessmentId };
  const { data: created, error: insertError } = await supabase
    .from("assessment_attempts")
    .insert(insert)
    .select("*")
    .single();

  if (insertError) {
    // Course concurrente (deux onglets) : la contrainte unique protège le
    // couple (user_id, assessment_id) — relire la tentative existante.
    if (insertError.code === "23505") {
      const { data: existing, error: readError } = await supabase
        .from("assessment_attempts")
        .select("*")
        .eq("user_id", userId)
        .eq("assessment_id", assessmentId)
        .maybeSingle();
      if (!readError && existing) return normalizeAttempt(existing);
    }
    throw insertError;
  }
  return normalizeAttempt(created);
}

/**
 * Met à jour la progression d'une tentative : position courante, statut,
 * last_activity_at (et completed_at si passage en "completed").
 */
export async function updateAttemptProgress(attemptId, patch = {}) {
  const update = { last_activity_at: new Date().toISOString() };
  if (patch.currentQuestionId !== undefined) update.current_question_id = patch.currentQuestionId;
  if (patch.status) {
    update.status = patch.status;
    if (patch.status === "completed") update.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("assessment_attempts")
    .update(update)
    .eq("id", attemptId);

  if (error) throw error;
}

/**
 * Supprime une tentative (cascade sur les réponses via FK).
 * Réservé au propriétaire (RLS) — utilisé pour repartir de zéro.
 */
export async function deleteAttempt(attemptId) {
  const { error } = await supabase
    .from("assessment_attempts")
    .delete()
    .eq("id", attemptId);
  if (error) throw error;
}

/**
 * Liste toutes les tentatives (réservé aux rôles administrateurs via RLS).
 */
export async function listAllAttempts(assessmentId = ASSESSMENT_ID) {
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("*")
    .eq("assessment_id", assessmentId);

  if (error) throw error;
  return (data ?? []).map(normalizeAttempt);
}
