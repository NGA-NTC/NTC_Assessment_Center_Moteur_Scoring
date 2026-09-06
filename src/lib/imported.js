const modules = import.meta.glob("../reponses/*.json");

export async function listImportedResults() {
  const entries = [];
  await Promise.all(
    Object.entries(modules).map(async ([path, load]) => {
      try {
        const mod = await load();
        const data = mod && mod.default !== undefined ? mod.default : mod;
        if (!data || typeof data !== "object") return;
        const file = path.split("/").pop();
        entries.push({
          file,
          name: data.candidate || file.replace(/\.json$/i, ""),
          responses: {
            mcq: data.mcq || {},
            b7: data.b7 || {},
            b8: data.b8 || {},
          },
        });
      } catch {
        /* fichier JSON invalide ignoré */
      }
    })
  );
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}