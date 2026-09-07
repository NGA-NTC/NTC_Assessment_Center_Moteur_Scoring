import { normalizeResponses } from "./storage.js";

const srcModules = import.meta.glob("../reponses/*.json");
const rootModules = import.meta.glob("../../reponses/*.json");

export async function listImportedResults() {
  const entries = [];
  const seen = new Set();
  const loaders = [
    ...Object.entries(srcModules).map(([path, load]) => ({ path, load, rank: 0 })),
    ...Object.entries(rootModules).map(([path, load]) => ({ path, load, rank: 1 })),
  ].sort((a, b) => a.rank - b.rank);
  for (const { path, load } of loaders) {
    try {
      const mod = await load();
      const data = mod && mod.default !== undefined ? mod.default : mod;
      if (!data || typeof data !== "object") continue;
      const file = path.split("/").pop();
      if (seen.has(file)) continue;
      seen.add(file);
      const norm = normalizeResponses(data);
      entries.push({
        file,
        name: data.candidate || file.replace(/\.json$/i, ""),
        responses: norm,
      });
    } catch {
      /* fichier JSON invalide ignoré */
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}