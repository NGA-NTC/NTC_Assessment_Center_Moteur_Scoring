import { supabase } from "../../../lib/supabaseClient.js";

export async function listAssignableRoles() {
  const { data, error } = await supabase.rpc("list_assignable_roles");
  if (error) throw error;
  return data ?? [];
}