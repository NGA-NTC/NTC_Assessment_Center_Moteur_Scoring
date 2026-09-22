import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, AlertCircle, Shield, Network } from "lucide-react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Alert from "../ui/Alert.jsx";
import { EmptyState, LoadingState } from "../ui/States.jsx";
import { listRoles } from "../../services/rbac/roles/listRoles.js";
import { listRoleAssignability, setRoleAssignability } from "../../services/rbac/roleAssignability/index.js";
import { useEffectiveAuthority } from "../../hooks/auth/useEffectiveAuthority.js";

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
      <Card className="p-5">
        <div className="flex items-start gap-2.5 text-[14px] text-muted-foreground">
          <Network size={20} className="mt-0.5 shrink-0" />
          <span>
            Assignabilité des rôles — requiert la capacité DELEGATE sur{" "}
            <code className="rounded-sm border border-border bg-muted px-1 py-0.5 font-mono text-[12px]">
              rbac.role_assignability
            </code>
            .
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-cream px-6 py-5">
        <div className="flex items-center gap-3">
          <Network size={22} className="shrink-0 text-gold" />
          <div>
            <div className="text-[16px] font-semibold text-foreground">Assignabilité des rôles</div>
            <div className="mt-0.5 max-w-[620px] text-[12.5px] text-muted-foreground">
              Un rôle « assigneur » peut-il être attribué aux utilisateurs ? Les cellules se configurent indépendamment par rôle.
            </div>
          </div>
        </div>
        <Shield size={20} className="shrink-0 text-gold" />
      </div>

      {message && (
        <Alert type={message.type === "success" ? "success" : "error"} className="mx-6 mt-4">
          {message.text}
        </Alert>
      )}

      <div className="p-6">
        {loading ? (
          <LoadingState minHeight={160} />
        ) : roles.length === 0 ? (
          <EmptyState icon={AlertCircle} title="Aucun rôle défini" description="Aucun rôle n'est configuré dans le système." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th className="min-w-[180px] border-b border-border bg-line-soft px-3 py-2.5 text-left align-middle text-[11px] font-bold tracking-[0.5px] text-muted-foreground uppercase">
                    Rôle assigné à un utilisateur
                  </th>
                  {roles.map((b) => (
                    <th
                      key={b.id}
                      title={b.id}
                      className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap border-b border-border bg-line-soft px-1.5 py-2.5 text-center align-middle text-[12px] font-bold text-navy"
                    >
                      {b.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((a) => (
                  <tr key={a.id}>
                    <td
                      className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap border-b border-border px-3 py-2 text-[13px] font-medium text-foreground"
                      title={a.id}
                    >
                      {a.name}
                    </td>
                    {roles.map((b) => {
                      const isSelf = a.id === b.id;
                      const checked = edges.has(edgeKey(a.id, b.id));
                      return (
                        <td
                          key={b.id}
                          className={
                            "border-b border-border px-1.5 py-2 text-center align-middle " +
                            (isSelf ? "bg-neutral-soft" : "bg-surface")
                          }
                        >
                          {isSelf ? (
                            <span
                              className="text-[12px] text-muted-foreground"
                              title="Un rôle ne peut pas s'assigner lui-même"
                            >
                              —
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(a.id, b.id)}
                              title={`${a.name} peut être attribué : ${checked ? "oui" : "non"}`}
                              className="h-4 w-4 cursor-pointer accent-gold"
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

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-cream px-6 py-4">
        {dirtyCount > 0 ? (
          <span className="text-[12px] font-semibold text-navy">
            {dirtyCount} modification(s) en attente
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground">Aucune modification en attente</span>
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