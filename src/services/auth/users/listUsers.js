import { supabase } from "../../../lib/supabaseClient.js";

export async function listUsers() {
  const { data, error } = await supabase.rpc("admin_get_users");
  if (error) throw error;
  return (data ?? []).map(normalizeUser);
}

function normalizeUser(row) {
  return {
    ...row,
    id: row.user_id,
    user_id: row.user_id,
    created_at: row.auth_created_at ?? row.created_at ?? null,
    role_ids: Array.isArray(row.role_ids) ? row.role_ids : [],
  };
}