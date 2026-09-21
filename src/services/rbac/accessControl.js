import { supabase } from "../../lib/supabaseClient.js";

export async function listRoles() {
  const { data, error } = await supabase
    .from("roles")
    .select("id, name")
    .order("id");

  if (error) throw error;
  return data ?? [];
}

export async function listPermissions() {
  const { data, error } = await supabase
    .from("permissions")
    .select("id, name, description, category")
    .order("category, name");

  if (error) throw error;
  return data ?? [];
}