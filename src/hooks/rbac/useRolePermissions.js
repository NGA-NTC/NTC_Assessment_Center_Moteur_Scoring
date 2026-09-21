import { useCallback, useEffect, useState } from "react";
import {
  grantRolePermission,
  revokeRolePermission,
  listRolePermissions,
} from "../../services/rbac/rolePermissions/index.js";

export function useRolePermissions({ roleId } = {}) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(Boolean(roleId));
  const [error, setError] = useState(null);

  const refresh = useCallback(
    async (targetRoleId = roleId) => {
      if (!targetRoleId) {
        setPermissions([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setPermissions(await listRolePermissions(targetRoleId));
      } catch (err) {
        setError(err.message || "Erreur de chargement des permissions");
      } finally {
        setLoading(false);
      }
    },
    [roleId]
  );

  const grant = useCallback((params) => grantRolePermission(params), []);
  const revoke = useCallback((params) => revokeRolePermission(params), []);

  useEffect(() => {
    if (!roleId) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await listRolePermissions(roleId);
        if (cancelled) return;
        setPermissions(data);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Erreur de chargement des permissions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roleId]);

  return { permissions, loading, error, refresh, grant, revoke };
}