import { supabase } from "../../../lib/supabaseClient.js";

/**
 * Autorité effective de l'utilisateur : regroupe les capacités
 * (USE/MANAGE/GRANT/DELEGATE) effectives par permission, en tenant compte
 * des rôles, délégations, scopes, expiration et révocation.
 * La vérification est centralisée côté backend (get_effective_authority).
 */
export async function getEffectiveAuthority(userId) {
  const { data, error } = await supabase.rpc("get_effective_authority", {
    p_user_id: userId,
  });

  if (error) throw error;
  return data ?? [];
}