import { createClient } from "@supabase/supabase-js";
import { signUpAccount } from "../signUp.js";
import { ensureLocalAccount, linkImportedToAccount } from "../../../lib/storage.js";

let inviteClient;

function getInviteClient() {
  if (!inviteClient) {
    inviteClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
  }
  return inviteClient;
}

function isAlreadyRegistered(message) {
  return /already registered|déjà enregistr|existe déjà|already exists/i.test(message || "");
}

export async function createCandidateAccount({ email, password, responses, importedId }) {
  const normalized = String(email || "").trim().toLowerCase();

  let existed = false;
  let confirmationRequired = false;

  const res = await signUpAccount(getInviteClient(), { email: normalized, password });
  if (res.error) {
    if (!isAlreadyRegistered(res.error)) return { error: res.error };
    existed = true;
  } else {
    confirmationRequired = Boolean(res.confirmationRequired);
  }

  // Miroir local du compte (idempotent) : nécessaire à l'autosave du
  // questionnaire et à l'affichage dans Résultats, même avec 0 réponse.
  const mirrored = await ensureLocalAccount(normalized, responses);
  if (!mirrored) return { error: "Impossible d'initialiser le compte candidat local." };

  if (importedId) await linkImportedToAccount(importedId, normalized);

  return { ok: true, existed, confirmationRequired, email: normalized };
}