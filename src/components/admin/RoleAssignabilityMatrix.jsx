import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, AlertCircle, CheckCircle2, Shield, Network } from "lucide-react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { listRoles } from "../../services/rbac/roles/listRoles.js";
import { listRoleAssignability, setRoleAssignability } from "../../services/rbac/roleAssignability/index.js";
import { useEffectiveAuthority } from "../../hooks/auth/useEffectiveAuthority.js";
import { NAVY, MUTED, LINE, CREAM, INK, GOLD } from "../../lib/theme.js";

const edgeKey = (assigner, assignable) => `${assigner}|${assignable}`;

export default function RoleAssignabilityMatrix() {
  const { can } = useEffectiveAuthority();
  const canDelegate = can("rbac.role_assignability", "DELEGATE");

  const [roles, setRoles] = useState([]);
  const [edges, setEdges] = useState(() => new Set());
  const [baseEdges, setBaseEdges] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setMessage(null);

    Promise.resolve()
      .then(() => Promise.all([listRoles(), listRoleAssignability()]))
      .then(([roleRows, graph]) => {
        setRoles(roleRows);
        const next = new Set(graph.map((e) => edgeKey(e.assigner_role_id, e.assignable_role_id)));
        setEdges(next);
        setBaseEdges(new Set(next));
      })
      .catch((err) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const hasChanges = useMemo(() => {
    if (edges.size !== baseEdges.size) return true;
    for (const key of edges) {
      if (!baseEdges.has(key)) return true;
    }
    return false;
  }, [edges, baseEdges]);

  const dirtyCount = useMemo(() => {
    let count = 0;
    roles.forEach((a) =>
      roles.forEach((b) => {
        if (a.id === b.id) return;
        if (edges.has(edgeKey(a.id, b.id)) !== baseEdges.has(edgeKey(a.id, b.id))) count += 1;
      })
    );
    return count;
  }, [roles, edges, baseEdges]);

  const toggle = (assignerId, assignableId) => {
    if (assignerId === assignableId) return;
    setMessage(null);
    setEdges((prev) => {
      const next = new Set(prev);
      const key = edgeKey(assignerId, assignableId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const reset = () => {
    setEdges(new Set(baseEdges));
    setMessage(null);
  };

  const save = async () => {
    const changes = [];
    roles.forEach((a) =>
      roles.forEach((b) => {
        if (a.id === b.id) return;
        const enabled = edges.has(edgeKey(a.id, b.id));
        const wasEnabled = baseEdges.has(edgeKey(a.id, b.id));
        if (enabled !== wasEnabled) changes.push({ a: a.id, b: b.id, enable: enabled });
      })
    );

    if (changes.length === 0) return;

    setSaving(true);
    setMessage(null);
    try {
      for (const change of changes) {
        await setRoleAssignability(change.a, change.b, change.enable);
      }
      setEdges((prev) => {
        const next = new Set(prev);
        changes.forEach((c) => {
          const key = edgeKey(c.a, c.b);
          if (c.enable) next.add(key);
          else next.delete(key);
        });
        return next;
      });
      setBaseEdges((prev) => {
        const next = new Set(prev);
        changes.forEach((c) => {
          const key = edgeKey(c.a, c.b);
          if (c.enable) next.add(key);
          else next.delete(key);
        });
        return next;
      });
      setMessage({ type: "success", text: `${changes.length} relation(s) d'assignabilité mise(s) à jour.` });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!canDelegate) {
    return (
      <Card style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Network size={20} color={MUTED} />
          <span style={{ fontSize: 14, color: MUTED }}>
            Assignabilité des rôles — requiert la capacité DELEGATE sur <code>rbac.role_assignability</code>.
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LINE}`, background: CREAM, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Network size={22} color={GOLD} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>Assignabilité des rôles</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
              Un rôle « assigneur » peut-il être attribué aux utilisateurs ? Les cellules se configurent indépendamment par rôle.
            </div>
          </div>
        </div>
        <Shield size={20} color={GOLD} />
      </div>

      {message && (
        <div style={{ margin: "16px 24px 0", padding: "12px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, background: message.type === "success" ? "#E3F0E4" : "#FAE8E6", color: message.type === "success" ? "#2E6B3C" : "#8A2B22", fontSize: 13 }}>
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div style={{ padding: "20px 24px" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: MUTED }}>
            <Loader2 size={24} className="spin" style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} /> Chargement…
          </div>
        ) : roles.length === 0 ? (
          <div style={{ textAlign: "center", color: MUTED, padding: "40px" }}>
            <AlertCircle size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ margin: 0 }}>Aucun rôle défini dans le système.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 480 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: 0.5, color: MUTED,
                      borderBottom: `1px solid ${LINE}`, minWidth: 180, background: "#FDFCF9",
                    }}
                  >
                    Rôle assigné à un utilisateur
                  </th>
                  {roles.map((b) => (
                    <th
                      key={b.id}
                      title={b.id}
                      style={{
                        textAlign: "center", padding: "10px 6px", fontSize: 12, fontWeight: 700, color: NAVY,
                        borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", overflow: "hidden",
                        textOverflow: "ellipsis", maxWidth: 120, background: "#FDFCF9",
                      }}
                    >
                      {b.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((a) => (
                  <tr key={a.id}>
                    <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500, color: INK, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }} title={a.id}>
                      {a.name}
                    </td>
                    {roles.map((b) => {
                      const isSelf = a.id === b.id;
                      const checked = edges.has(edgeKey(a.id, b.id));
                      return (
                        <td key={b.id} style={{ textAlign: "center", padding: "8px 6px", borderBottom: `1px solid ${LINE}`, background: isSelf ? "#F6F5F1" : "#fff" }}>
                          {isSelf ? (
                            <span style={{ color: MUTED, fontSize: 12 }} title="Un rôle ne peut pas s'assigner lui-même">—</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(a.id, b.id)}
                              title={`${a.name} peut être attribué : ${checked ? "oui" : "non"}`}
                              style={{ width: 16, height: 16, accentColor: GOLD, cursor: "pointer" }}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 24px", borderTop: `1px solid ${LINE}`, background: CREAM, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {dirtyCount > 0 ? (
          <span style={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>
            {dirtyCount} modification(s) en attente
          </span>
        ) : (
          <span style={{ fontSize: 12, color: MUTED }}>Aucune modification en attente</span>
        )}
        <Button variant="ghost" size="sm" onClick={reset} disabled={saving || !hasChanges}>
          Annuler
        </Button>
        <Button onClick={save} disabled={saving || !hasChanges}>
          <Save size={16} /> {saving ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>
    </Card>
  );
}