import {
  accountProgress,
  computeAxisScores,
  computeCoherence,
  computeDimensionScores,
  computeRoleFit,
} from "./scoring.js";

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const EMPTY_RESPONSES = { mcq: {}, b7: {}, b8: {} };

export const safeResponses = (r) => (r && typeof r === "object" ? r : EMPTY_RESPONSES);

export function computeCandidateScoring(responses) {
  if (!responses || typeof responses !== "object") return { axes: {}, roles: [] };
  const dims = computeDimensionScores(responses);
  const coherence = computeCoherence(dims, responses.b8);
  const axes = computeAxisScores(dims, coherence);
  return { axes, roles: computeRoleFit(dims, axes) };
}

export function buildCandidates({ accounts = [], staticImports = [], runtimeImports = [], hiddenStatic = [] }) {
  const hidden = new Set(hiddenStatic);
  return [
    ...accounts.map((a) => ({
      kind: "acct",
      id: "acct:" + a.email,
      label: a.email,
      badge: "Compte",
      badgeTone: "compte",
      meta: `Inscrit le ${formatDate(a.createdAt)}`,
      responses: safeResponses(a.responses),
      progress: accountProgress(a.responses),
      sc: computeCandidateScoring(a.responses),
      search: `${a.email} ${a.email}`,
      data: a,
    })),
    ...staticImports.filter((f) => !hidden.has(f.file)).map((f) => ({
      kind: "imp",
      id: "imp:static:" + f.file,
      label: f.name,
      badge: "Importé",
      badgeTone: "import",
      meta: `Fichier ${f.file}`,
      responses: safeResponses(f.responses),
      progress: accountProgress(f.responses),
      sc: computeCandidateScoring(f.responses),
      search: `${f.name} ${f.file}`,
      data: f,
      isStatic: true,
      file: f.file,
    })),
    ...runtimeImports.map((im) => ({
      kind: "imp",
      id: "imp:" + im.id,
      label: im.label,
      badge: "Importé",
      badgeTone: "import",
      meta: im.email || `Importé le ${formatDate(im.importedAt || im.createdAt)}`,
      responses: safeResponses(im.responses),
      progress: accountProgress(im.responses),
      sc: computeCandidateScoring(im.responses),
      search: `${im.label} ${im.email || ""}`,
      data: im,
      linked: im.accountEmail || null,
    })),
  ];
}