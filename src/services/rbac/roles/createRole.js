import { supabase } from "../../../lib/supabaseClient.js";

export async function createRole({ id, name, description, is_assignable, parent_id }) {
  const { error } = await supabase
    .from("roles")
    .insert({ id, name, description, is_assignable, parent_id });

  if (error) throw error;
}