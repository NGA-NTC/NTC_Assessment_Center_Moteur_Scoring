import { supabase } from "../../../lib/supabaseClient.js";

export async function listRoles() {
  const { data, error } = await supabase
    .from("roles")
    .select("id, name, description, is_assignable, parent_id, is_system")
    .order("id");

  if (error) throw error;
  return data ?? [];
}