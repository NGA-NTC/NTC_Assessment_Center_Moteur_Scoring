import { supabase } from "../../../lib/supabaseClient.js";

export async function resetPassword(userId) {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ target_user_id: userId }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Erreur lors de l'envoi");
}