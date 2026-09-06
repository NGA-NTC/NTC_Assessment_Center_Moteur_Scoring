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

export async function listImported() {
  const raw = await storeGet(IMPORTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function addImported(record) {
  const imports = await listImported();
  imports.push(record);
  await storeSet(IMPORTS_KEY, JSON.stringify(imports));
  return record;
}

export async function linkImportedToAccount(id, email) {
  const imports = await listImported();
  const match = imports.find((im) => im.id === id);
  if (!match) return;
  match.accountEmail = email;
  match.updatedAt = new Date().toISOString();
  await storeSet(IMPORTS_KEY, JSON.stringify(imports));
}

export function parseCandidateImport(text, fallbackName) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  const base = fallbackName ? String(fallbackName).replace(/\.json$/i, "") : "Candidat importé";
  const list = Array.isArray(data) ? data : [data];
  const records = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const isRaw = item.mcq || item.b7 || item.b8;
    const raw = item.responses && typeof item.responses === "object" ? item.responses : isRaw ? item : null;
    if (!raw) return;
    const suffix = list.length > 1 ? ` (${i + 1})` : "";
    records.push({
      label: String(item.label || item.name || item.email || `${base}${suffix}` || `Candidat importé${suffix}`),
      email: typeof item.email === "string" && item.email ? item.email : null,
      responses: { mcq: raw.mcq || {}, b7: raw.b7 || {}, b8: raw.b8 || {} },
    });
  });
  return records;
}