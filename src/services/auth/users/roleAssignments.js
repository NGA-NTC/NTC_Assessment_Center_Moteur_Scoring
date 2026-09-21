import { supabase } from "../../../lib/supabaseClient.js";

export async function assignRole(userId, roleId) {
  const { error } = await supabase.rpc("assign_user_role", {
    p_target_user_id: userId,
    p_role_id: roleId,
    p_expires_at: null,
  });
  if (error) throw error;
}

export async function removeRole(userId, roleId) {
  const { error } = await supabase.rpc("revoke_user_role", {
    p_target_user_id: userId,
    p_role_id: roleId,
  });
  if (error) throw error;
}

export async function setUserRoles(userId, roleIds) {
  const { data: current, error: fetchError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);
  if (fetchError) throw fetchError;

  const currentIds = (current || []).map((r) => r.role_id);
  const toAssign = roleIds.filter((r) => !currentIds.includes(r));
  const toRevoke = currentIds.filter((r) => !roleIds.includes(r));

  for (const roleId of toRevoke) {
    await removeRole(userId, roleId);
  }
  for (const roleId of toAssign) {
    await assignRole(userId, roleId);
  }
}