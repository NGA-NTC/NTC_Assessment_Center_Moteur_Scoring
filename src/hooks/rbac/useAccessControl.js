import { useCallback, useEffect, useRef, useState } from "react";
import { CAPABILITIES, CAPABILITY_KEYS, GRANT_DEFAULT_CAPABILITIES } from "../../constants/rbac.js";
import { listRoles, listPermissions } from "../../services/rbac/accessControl.js";
import {
  grantRolePermission,
  revokeRolePermission,
  listRolePermissions,
} from "../../services/rbac/rolePermissions/index.js";

const EMPTY_CAPS = { use: false, manage: false, grant: false, delegate: false };
const capKey = (cap) => cap.toLowerCase();
const STABLE_EMPTY = () => ({ use: false, manage: false, grant: false, delegate: false });

function rowsToCaps(row) {
  return {
    use: !!row.can_use,
    manage: !!row.can_manage,
    grant: !!row.can_grant,
    delegate: !!row.can_delegate,
  };
}

function cloneMatrix(matrix) {
  return Object.fromEntries(
    Object.entries(matrix).map(([roleId, perms]) => [
      roleId,
      Object.fromEntries(Object.entries(perms).map(([permId, caps]) => [permId, { ...caps }])),
    ])
  );
}

export function useAccessControl() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [baseMatrix, setBaseMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const buildMatrix = (rpData) => {
    const map = {};
    rpData.forEach((row) => {
      if (!map[row.role_id]) map[row.role_id] = {};
      map[row.role_id][row.permission_id] = rowsToCaps(row);
    });
    return map;
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, permsData, rpData] = await Promise.all([
        listRoles(),
        listPermissions(),
        listRolePermissions(),
      ]);
      if (!mountedRef.current) return;

      setRoles(rolesData);
      setPermissions(permsData);

      const nextMatrix = buildMatrix(rpData);
      setBaseMatrix(cloneMatrix(nextMatrix));
      setMatrix(nextMatrix);

      if (rolesData.length > 0) {
        setSelectedRoleId((prev) => prev ?? rolesData[0].id);
      }
    } catch (err) {
      if (mountedRef.current) setError(err.message || "Impossible de charger les données d'accès.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { refresh(); }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const selectRole = useCallback((roleId) => setSelectedRoleId(roleId), []);

  const toggleCapability = useCallback((roleId, permissionId, capabilityKey) => {
    setMatrix((prev) => {
      const rolePerms = { ...(prev[roleId] ?? {}) };
      const current = { ...(rolePerms[permissionId] ?? STABLE_EMPTY()) };
      current[capabilityKey] = !current[capabilityKey];
      rolePerms[permissionId] = current;
      return { ...prev, [roleId]: rolePerms };
    });
  }, []);

  const currentRoleMatrix = matrix[selectedRoleId] ?? {};
  const baseRoleMatrix = baseMatrix[selectedRoleId] ?? {};
  const hasChanges =
    selectedRoleId && JSON.stringify(currentRoleMatrix) !== JSON.stringify(baseRoleMatrix);

  const save = useCallback(async () => {
    if (!selectedRoleId) return { ok: false, error: "Aucun rôle sélectionné." };

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const current = matrix[selectedRoleId] ?? {};
      const base = baseMatrix[selectedRoleId] ?? {};
      const permIds = new Set([...Object.keys(base), ...Object.keys(current)]);

      for (const permId of permIds) {
        const before = base[permId] ?? EMPTY_CAPS;
        const after = current[permId];
        const hasCaps = after && CAPABILITY_KEYS.some((key) => after[key]);

        if (!hasCaps) {
          const toRevoke = CAPABILITIES.filter((cap) => before[capKey(cap)]);
          if (toRevoke.length > 0) {
            await revokeRolePermission({
              roleId: selectedRoleId,
              permissionId: permId,
              capabilities: toRevoke,
              scopeType: "global",
              scopeValue: null,
            });
          }
          continue;
        }

        const revoked = CAPABILITIES.filter((cap) => before[capKey(cap)] && !after[capKey(cap)]);
        if (revoked.length > 0) {
          await revokeRolePermission({
            roleId: selectedRoleId,
            permissionId: permId,
            capabilities: revoked,
            scopeType: "global",
            scopeValue: null,
          });
        }

        const added = CAPABILITIES.filter((cap) => after[capKey(cap)] && !before[capKey(cap)]);
        if (added.length > 0) {
          await grantRolePermission({
            roleId: selectedRoleId,
            permissionId: permId,
            capabilities: after,
            scopeType: "global",
            scopeValue: null,
          });
        }
      }

      const refreshed = await listRolePermissions(selectedRoleId);
      if (!mountedRef.current) return { ok: true };

      const refreshedMap = buildMatrix(refreshed);
      const refreshedRoleMap = refreshedMap[selectedRoleId] ?? {};
      const clonedRoleMap = Object.fromEntries(Object.entries(refreshedRoleMap).map(([permId, caps]) => [permId, { ...caps }]));
      setMatrix((prev) => ({ ...prev, [selectedRoleId]: clonedRoleMap }));
      setBaseMatrix((prev) => ({ ...prev, [selectedRoleId]: cloneMatrix({ x: clonedRoleMap }).x }));

      setSuccess("Accès enregistrés.");
      return { ok: true };
    } catch (err) {
      const errorMessage = err.message || "Erreur lors de la sauvegarde.";
      setError(errorMessage);
      return { ok: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  }, [selectedRoleId, matrix, baseMatrix]);

  return {
    roles,
    permissions,
    matrix,
    selectedRoleId,
    selectedRole: roles.find((r) => r.id === selectedRoleId) ?? null,
    loading,
    saving,
    error,
    success,
    hasChanges,
    selectRole,
    toggleCapability,
    save,
    refresh,
    grantDefaults: GRANT_DEFAULT_CAPABILITIES,
  };
}