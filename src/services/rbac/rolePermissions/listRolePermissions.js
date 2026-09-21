import { supabase } from "../../../lib/supabaseClient.js";

export async function listRolePermissions(roleId) {
  let query = supabase
    .from("role_permissions")
    .select("*")
    .order("permission_id");

  if (roleId) {
    query = query.eq("role_id", roleId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}