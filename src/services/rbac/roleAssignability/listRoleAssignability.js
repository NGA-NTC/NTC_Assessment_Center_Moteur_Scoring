import { supabase } from "../../../lib/supabaseClient.js";

export async function listRoleAssignability() {
  const { data, error } = await supabase.rpc("list_role_assignability");

  if (error) throw error;
  return data ?? [];
}