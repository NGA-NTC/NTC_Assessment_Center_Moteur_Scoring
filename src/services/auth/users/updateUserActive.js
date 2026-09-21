import { supabase } from "../../../lib/supabaseClient.js";

export async function updateUserActive(userId, active) {
  const { error } = await supabase.rpc("admin_set_user_active", {
    p_target_user_id: userId,
    p_active: active,
  });
  if (error) throw error;
}