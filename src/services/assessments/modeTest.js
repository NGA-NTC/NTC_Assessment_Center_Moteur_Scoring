import { listUsers } from "../auth/users/index.js";
import { listAllAttempts } from "./attempts.js";
import { listResponses } from "./responses.js";
import { loadBatteries } from "./questions.js";
import { listAccounts, listImported, listHiddenStaticFiles } from "../../lib/storage.js";
import { listImportedResults } from "../../lib/imported.js";
import { buildCandidates } from "../../lib/candidates.js";

// S9-2 : chaîne de chargement de la relecture « Voir les réponses (mode test) ».
//
// Candidat plateforme ("supabase:<user_id>", format produit par AdminResultats) :
//   profiles (RPC admin_get_users, non bloquant) → assessment_attempts (par
//   user_id) → assessment_responses → assessment_questions via loadBatteries()
//   (la MÊME source que le questionnaire candidat /test, fallback statique
//   garanti). Aucune lecture localStorage : la relecture fonctionne sur un
//   navigateur sans aucune donnée candidat locale.
//
// Formats legacy ("acct:<email>", "imp:<id>", "imp:static:<file>") : sources
// locales historiques (imports, comptes locaux) — inchangées.

const SUPABASE_PREFIX = "supabase:";

function emptyResponses() {
  return { mcq: {}, b7: {}, b8: {} };
}

/** Point d'entrée unique : retourne les données de relecture ou { error }. */
export async function loadModeTestCandidate(decodedId) {
  if (typeof decodedId === "string" && decodedId.startsWith(SUPABASE_PREFIX)) {
    return loadSupabaseCandidate(decodedId.slice(SUPABASE_PREFIX.length));
  }
  return loadLegacyCandidate(decodedId);
}

/**
 * Candidat plateforme : lecture en base, en lecture seule.
 * Ne lève jamais — retourne { error } si une lecture nécessaire échoue.
 */
async function loadSupabaseCandidate(userId) {
  if (!userId) return { error: "Identifiant utilisateur manquant dans le lien." };

  // 1) Profil (label) via le RPC admin — non bloquant en cas d'échec.
  let label = "Candidat plateforme";
  try {
    const users = await listUsers();
    const u = (users || []).find((x) => x.user_id === userId || x.id === userId);
    if (u) label = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || label;
  } catch {
    // RPC/RLS indisponible : on continue sans label précis.
  }

  // 2) Tentative de l'utilisateur (lecture seule — jamais de création ici).
  let attempt;
  try {
    const attempts = await listAllAttempts();
    attempt = (attempts || []).find((a) => a.userId === userId) || null;
  } catch {
    return { error: "Lecture des tentatives impossible (Supabase indisponible ?)." };
  }

  // 3) Réponses persistées (partielles possibles : ex. 10/197).
  let responses = emptyResponses();
  if (attempt) {
    try {
      responses = await listResponses(attempt.id);
    } catch {
      return { error: "Lecture des réponses impossible (Supabase indisponible ?)." };
    }
  }

  // 4) Questions : même source que /test (Supabase, fallback statique complet).
  const loaded = await loadBatteries();

  return {
    kind: "supabase",
    userId,
    label,
    attempt,
    responses,
    batteries: loaded.batteries,
    fallback: Boolean(loaded.fallback),
  };
}

/**
 * Formats legacy : relecture depuis les sources locales historiques.
 * Un candidat "supabase:" n'y figure jamais — aucune persistance locale
 * n'est (ré)introduite pour les comptes plateforme.
 */
async function loadLegacyCandidate(decodedId) {
  try {
    const [accounts, staticImports, hiddenStatic, runtimeImports] = await Promise.all([
      listAccounts(),
      listImportedResults(),
      listHiddenStaticFiles().catch(() => []),
      listImported(),
    ]);
    const found = buildCandidates({ accounts, staticImports, runtimeImports, hiddenStatic })
      .find((c) => c.id === decodedId) || null;
    if (!found) return { error: "Candidat introuvable ou supprimé." };
    const loaded = await loadBatteries();
    return {
      kind: "legacy",
      label: found.label,
      attempt: null,
      responses: found.responses || emptyResponses(),
      batteries: loaded.batteries,
      fallback: Boolean(loaded.fallback),
    };
  } catch {
    return { error: "Chargement du candidat impossible." };
  }
}
