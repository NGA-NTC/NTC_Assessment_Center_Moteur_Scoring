import { supabase } from "../../../lib/supabaseClient.js";

export async function deleteRole(roleId) {
  const { data: existing, error: fetchError } = await supabase
    .from("roles")
    .select("is_system")
    .eq("id", roleId)
    .single();
  if (fetchError) throw fetchError;

  if (existing?.is_system) throw new Error("ROLE_SYSTEME_INSUPPRIMABLE");

  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId);

  if (error) throw error;
}