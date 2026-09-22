import { supabase } from "../../../lib/supabaseClient.js";

export async function setRoleAssignability(assignerRoleId, assignableRoleId, allow) {
  const { error } = await supabase.rpc("set_role_assignability", {
    p_assigner_role_id: assignerRoleId,
    p_assignable_role_id: assignableRoleId,
    p_allow: allow,
  });

  if (error) throw error;
}