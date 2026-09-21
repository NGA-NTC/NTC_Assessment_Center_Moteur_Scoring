import { supabase } from "../../../lib/supabaseClient.js";
import { CAPABILITY_KEYS, GRANT_DEFAULT_CAPABILITIES, RBAC_SCOPES } from "../../../constants/rbac.js";

export async function grantRolePermission({
  roleId,
  permissionId,
  capabilities = GRANT_DEFAULT_CAPABILITIES,
  scopeType = "global",
  scopeValue = null,
}) {
  const invalidKey = Object.keys(capabilities).find((key) => !CAPABILITY_KEYS.includes(key));
  if (invalidKey) {
    throw new Error(`Capability invalide: ${invalidKey}`);
  }
  if (!RBAC_SCOPES.includes(scopeType)) {
    throw new Error(`scope_type invalide: ${scopeType}`);
  }

  const { data, error } = await supabase.rpc("grant_role_permission", {
    p_target_role_id: roleId,
    p_permission_id: permissionId,
    p_capabilities: capabilities,
    p_scope_type: scopeType,
    p_scope_value: scopeValue,
  });

  if (error) throw error;
  return data;
}