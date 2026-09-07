const USERS_KEY = "ntc_users";

async function storeGet(key) {
  try {
    if (window.storage) {
      const r = await window.storage.get(key, false);
      return r ? r.value : null;
    }
  } catch { /* fallback */ }
  try { return localStorage.getItem(key); } catch { return null; }
}

async function storeSet(key, value) {
  try {
    if (window.storage) { await window.storage.set(key, value, false); return; }
  } catch { /* fallback */ }
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

export async function listAccounts() {
  const raw = await storeGet(USERS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function createAccount(email, password, responses) {
  const normalized = (email || "").trim().toLowerCase();
  const users = await listAccounts();
  if (users.some((u) => u.email === normalized)) return { error: "Un compte existe déjà avec cet email." };
  const now = new Date().toISOString();
  const raw = responses && typeof responses === "object" ? responses : {};
  const account = {
    email: normalized,
    password,
    createdAt: now,
    updatedAt: now,
    responses: { mcq: raw.mcq || {}, b7: raw.b7 || {}, b8: raw.b8 || {} },
  };
  users.push(account);
  await storeSet(USERS_KEY, JSON.stringify(users));
  return { account };
}

export async function findAccount(email, password) {
  const normalized = (email || "").trim().toLowerCase();
  const users = await listAccounts();
  const match = users.find((u) => u.email === normalized);
  if (!match || match.password !== (password || "")) return null;
  return match;
}

export async function loadAccountResponses(email) {
  const normalized = (email || "").trim().toLowerCase();
  const users = await listAccounts();
  const match = users.find((u) => u.email === normalized);
  return match ? match.responses : null;
}

export async function saveAccountResponses(email, responses) {
  const normalized = (email || "").trim().toLowerCase();
  const users = await listAccounts();
  const match = users.find((u) => u.email === normalized);
  if (!match) return false;
  match.responses = responses;
  match.updatedAt = new Date().toISOString();
  await storeSet(USERS_KEY, JSON.stringify(users));
  return true;
}

const IMPORTS_KEY = "ntc_imported";

async function readImports() {
  const raw = await storeGet(IMPORTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function listImported() {
  const all = await readImports();
  return all.filter((im) => im && im.kind !== "static");
}

export async function addImported(record) {
  const imports = await readImports();
  imports.push(record);
  await storeSet(IMPORTS_KEY, JSON.stringify(imports));
  return record;
}

export async function listHiddenStaticFiles() {
  const imports = await readImports();
  return imports.filter((im) => im.kind === "static" && im.hidden).map((im) => im.file);
}

export async function linkImportedToAccount(id, email) {
  const imports = await readImports();
  const match = imports.find((im) => im.id === id);
  if (!match) return;
  match.accountEmail = email;
  match.updatedAt = new Date().toISOString();
  await storeSet(IMPORTS_KEY, JSON.stringify(imports));
}

export async function saveImportedResponses(id, responses, label) {
  const imports = await readImports();
  const match = imports.find((im) => im.id === id);
  if (!match) return false;
  match.responses = { mcq: responses.mcq || {}, b7: responses.b7 || {}, b8: responses.b8 || {} };
  if (label) match.label = label;
  match.updatedAt = new Date().toISOString();
  await storeSet(IMPORTS_KEY, JSON.stringify(imports));
  return true;
}

export async function deleteImported(id) {
  const imports = await readImports();
  const next = imports.filter((im) => im.id !== id);
  if (next.length === imports.length) return false;
  await storeSet(IMPORTS_KEY, JSON.stringify(next));
  return true;
}

export async function markStaticHidden(file) {
  const imports = await readImports();
  const list = imports.filter((im) => !(im.kind === "static" && im.file === file));
  list.push({ kind: "static", file, hidden: true, createdAt: new Date().toISOString() });
  await storeSet(IMPORTS_KEY, JSON.stringify(list));
}

export async function updateAccountResponses(email, responses) {
  return saveAccountResponses(email, responses);
}

export async function deleteAccount(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const users = await listAccounts();
  const next = users.filter((u) => u.email !== normalized);
  if (next.length === users.length) return false;
  await storeSet(USERS_KEY, JSON.stringify(next));
  return true;
}

// Batteries QCM de la plateforme (batteries 1 à 6). Un fichier externe peut les
// fournir séparément (ex. "mcq" seule avec "Q1"…, ou en sections "V"/"D"/"L"/"S"/"P").
// Toutes sont fusionnées dans "mcq" pour correspondre au format interne.
const BATTERY_SECTIONS = ["Q", "V", "D", "L", "S", "P"];

// Normalise un objet réponses libre (mcq/b7/b8, ou sections V/D/L/S/P) vers le
// format canonique de la plateforme : { mcq:{…}, b7:{…}, b8:{…} }.
// Les valeurs B7 (ratings) sont conservées à l'identique : aucune transformation
// d'échelle n'est appliquée à l'import pour éviter tout biais.
export function normalizeResponses(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const wrap = src.responses && typeof src.responses === "object" ? src.responses : src;
  const mcq = { ...(wrap.mcq && typeof wrap.mcq === "object" ? wrap.mcq : {}) };

  // Batteries 2 à 6 fournies séparément (V, D, L, S, P) → fusionnées dans mcq.
  for (const sec of BATTERY_SECTIONS.slice(1)) {
    const section = wrap[sec];
    if (!section || typeof section !== "object") continue;
    Object.assign(mcq, section);
  }

  const b7 = {};
  const b7raw = wrap.b7 && typeof wrap.b7 === "object" ? wrap.b7 : wrap["B7"];
  if (b7raw && typeof b7raw === "object") {
    Object.entries(b7raw).forEach(([caseId, caseScores]) => {
      if (!caseScores || typeof caseScores !== "object") return;
      Object.entries(caseScores).forEach(([key, val]) => {
        if (val == null) return;
        b7[caseId] = b7[caseId] || {};
        b7[caseId][key] = val;
      });
    });
  }

  const b8raw = wrap.b8 && typeof wrap.b8 === "object" ? wrap.b8 : wrap["B8"];
  const b8 = b8raw && typeof b8raw === "object" ? b8raw : {};

  return { mcq: mcq || {}, b7: b7 || {}, b8: b8 || {} };
}

export function parseCandidateImport(text, fallbackName) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  const base = fallbackName ? String(fallbackName).replace(/\.json$/i, "") : "Candidat importé";
  const list = Array.isArray(data) ? data : [data];
  const records = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const norm = normalizeResponses(item);
    if (!Object.keys(norm.mcq).length && !Object.keys(norm.b7).length && !Object.keys(norm.b8).length) return;
    const suffix = list.length > 1 ? ` (${i + 1})` : "";
    records.push({
      label: String(item.label || item.name || item.email || `${base}${suffix}` || `Candidat importé${suffix}`),
      email: typeof item.email === "string" && item.email ? item.email : null,
      responses: norm,
    });
  });
  return records;
}