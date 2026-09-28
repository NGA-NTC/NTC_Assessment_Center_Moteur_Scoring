export function resolveSiteUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  return configured || window.location.origin;
}

export async function signUpAccount(client, { email, password }) {
  const normalized = String(email || "").trim().toLowerCase();
  const { data, error } = await client.auth.signUp(
    { email: normalized, password },
    { emailRedirectTo: resolveSiteUrl() }
  );
  if (error) return { error: error.message };
  if (data.user && !data.session) return { ok: true, confirmationRequired: true };
  return { ok: true, confirmationRequired: false };
}