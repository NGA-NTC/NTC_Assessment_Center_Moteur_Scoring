import { supabase } from "../../../lib/supabaseClient.js";

export async function updateRole(roleId, { name, description, is_assignable, parent_id }) {
  const { error } = await supabase
    .from("roles")
    .update({ name, description, is_assignable, parent_id })
    .eq("id", roleId);

  if (error) throw error;
}