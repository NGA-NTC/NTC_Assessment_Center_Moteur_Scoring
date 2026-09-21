import { supabase } from "../../../lib/supabaseClient.js";

export async function updateUserProfile(userId, updates) {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  if (error) throw error;
}