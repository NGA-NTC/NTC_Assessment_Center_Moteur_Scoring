import { useCallback, useEffect, useState } from "react";
import { getEffectiveAuthority } from "../../services/auth/authority/index.js";
import { useUserAuth } from "../../context/UserAuthContext.jsx";

/**
 * Autorité effective de l'utilisateur connecté (couche UX navigation).
 * API stable :
 *   { loading, can(permissionId, capability="USE"), refresh }
 *
 * `can()` est synchrone après chargement : l'autorité est préchargée une fois
 * via get_effective_authority puis mise en correspondance permission → capacités.
 * Seules les capacités de scope global représentent l'accès à l'espace complet
 * (équivalent à has_effective_capability(..., 'global', null)).
 */
export function useEffectiveAuthority() {
  const { user } = useUserAuth();
  const [authority, setAuthority] = useState({ userId: null, map: null });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    Promise.resolve()
      .then(() => getEffectiveAuthority(user.id))
      .then((rows) => {
        if (cancelled) return;
        setAuthority({ userId: user.id, map: buildAuthorityMap(rows) });
      })
      .catch(() => {
        if (cancelled) return;
        setAuthority({ userId: user.id, map: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, revision]);

  const can = useCallback(
    (permissionId, capability = "USE") => {
      if (authority.userId !== user?.id || !authority.map) return false;
      return authority.map.get(permissionId)?.has(capability) ?? false;
    },
    [authority, user]
  );

  return { loading, can, refresh };
}

function buildAuthorityMap(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.scope_type !== "global" || row.scope_value != null) continue;
    if (!map.has(row.permission_id)) map.set(row.permission_id, new Set());
    map.get(row.permission_id).add(row.capability);
  }
  return map;
}