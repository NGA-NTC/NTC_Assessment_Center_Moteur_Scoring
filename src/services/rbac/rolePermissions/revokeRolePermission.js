import { supabase } from "../../../lib/supabaseClient.js";
import { CAPABILITIES, RBAC_SCOPES } from "../../../constants/rbac.js";

export async function revokeRolePermission({
  roleId,
  permissionId,
  capabilities = CAPABILITIES,
  scopeType = "global",
  scopeValue = null,
}) {
  const caps = capabilities.length > 0 ? capabilities : CAPABILITIES;
  const invalidCap = caps.find((cap) => !CAPABILITIES.includes(cap));
  if (invalidCap) {
    throw new Error(`Capability invalide: ${invalidCap}`);
  }
  if (!RBAC_SCOPES.includes(scopeType)) {
    throw new Error(`scope_type invalide: ${scopeType}`);
  }

  const { data, error } = await supabase.rpc("revoke_role_permission", {
    p_target_role_id: roleId,
    p_permission_id: permissionId,
    p_capabilities: caps,
    p_scope_type: scopeType,
    p_scope_value: scopeValue,
  });

  if (error) throw error;
  return data;
}