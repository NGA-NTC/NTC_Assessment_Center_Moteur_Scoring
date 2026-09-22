import { useMemo } from "react";
import { Loader2, Shield, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import { NAVY, MUTED, LINE, CREAM, INK, GOLD } from "../lib/theme.js";
import Card from "../components/ui/Card.jsx";
import { useAccessControl } from "../hooks/rbac/useAccessControl.js";
import RoleAssignabilityMatrix from "../components/admin/RoleAssignabilityMatrix.jsx";

const CAPABILITY_COLUMNS = [
  { key: "use", label: "USE", hint: "Utilisation (consultation / exécution)" },
  { key: "manage", label: "MANAGE", hint: "Gestion (créer / modifier)" },
  { key: "grant", label: "GRANT", hint: "Accorder le droit à d'autres rôles ou utilisateurs" },
  { key: "delegate", label: "DELEGATE", hint: "Déléguer le droit (délégations)" },
];

export default function SuperAdminAccess() {
  const {
    roles,
    permissions,
    matrix,
    selectedRoleId,
    selectedRole,
    loading,
    saving,
    error,
    success,
    hasChanges,
    selectRole,
    toggleCapability,
    save,
  } = useAccessControl();

  const handleSave = async () => {
    await save();
  };

  const permissionsByCategory = useMemo(() => {
    const grouped = {};
    permissions.forEach((p) => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
    return grouped;
  }, [permissions]);

  const selectedRolePerms = selectedRoleId ? (matrix[selectedRoleId] ?? {}) : {};

  const lockedCap = (permId) =>
    selectedRoleId === "super_admin" && permId.startsWith("rbac.") ? ["grant", "delegate"] : [];

  return (
    <div>
      <PageTitle
        title="Accès"
        subtitle={
          loading
            ? "Chargement…"
            : selectedRole
            ? `Gestion des permissions pour « ${selectedRole.name} » — chaque capacité est indépendante`
            : "Sélectionnez un rôle"
        }
        action={
          selectedRole && (
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              <Save size={16} /> {saving ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          )
        }
      />

      {(error || success) && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, background: success ? "#E3F0E4" : "#FAE8E6", color: success ? "#2E6B3C" : "#8A2B22", fontSize: 13 }}>
          {success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{success ?? error}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
        <Card style={{ padding: 0, overflow: "hidden", height: "fit-content", position: "sticky", top: "100px" }}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LINE}`, background: CREAM, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>Rôles</div>
            <Shield size={20} color={GOLD} />
          </div>
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "24px", textAlign: "center", color: MUTED }}>
                <Loader2 size={24} className="spin" style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} /> Chargement…
              </div>
            ) : roles.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: MUTED }}>Aucun rôle</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {roles.map((role) => (
                  <li key={role.id}>
                    <button
                      onClick={() => selectRole(role.id)}
                      style={{
                        width: "100%", padding: "14px 20px", textAlign: "left", border: "none",
                        cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: selectedRoleId === role.id ? 600 : 500,
                        color: selectedRoleId === role.id ? NAVY : INK, borderLeft: selectedRoleId === role.id ? `3px solid ${GOLD}` : "3px solid transparent",
                        background: selectedRoleId === role.id ? "#F5F5F5" : "transparent", transition: "all .15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Shield size={18} color={selectedRoleId === role.id ? GOLD : MUTED} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontFamily: "monospace" }}>{role.id}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div>
          {loading ? (
            <Card style={{ padding: "48px", textAlign: "center", color: MUTED }}>
              <Loader2 size={24} className="spin" style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} /> Chargement des permissions…
            </Card>
          ) : !selectedRole ? (
            <Card style={{ padding: "48px", textAlign: "center", color: MUTED }}>
              <Shield size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, margin: 0 }}>Sélectionnez un rôle à gauche pour gérer ses accès</p>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LINE}`, background: CREAM }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>
                  Permissions pour <span style={{ color: NAVY }}>{selectedRole.name}</span>
                </div>
                <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
                  USE, MANAGE, GRANT et DELEGATE sont indépendants. Les changements ne sont appliqués qu'après sauvegarde.
                </div>
              </div>
              <div style={{ padding: "20px 24px", maxHeight: "70vh", overflowY: "auto" }}>
                <div
                  style={{
                    display: "grid", gridTemplateColumns: "1fr repeat(4, 72px)", gap: 8,
                    padding: "0 12px 10px 0", borderBottom: `1px solid ${LINE}`, marginBottom: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Permission</div>
                  {CAPABILITY_COLUMNS.map((col) => (
                    <div key={col.key} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: NAVY }} title={col.hint}>
                      {col.label}
                    </div>
                  ))}
                </div>

                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${LINE}` }}>
                      {category}
                    </div>
                    {perms.map((perm) => {
                      const caps = selectedRolePerms[perm.id] ?? {};
                      const locked = lockedCap(perm.id);
                      return (
                        <div
                          key={perm.id}
                          style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 72px)", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${LINE}` }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={perm.description || perm.id}>
                              {perm.name}
                            </div>
                            <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{perm.id}</div>
                          </div>
                          {CAPABILITY_COLUMNS.map((col) => {
                            const isLocked = locked.includes(col.key);
                            const checked = !!caps[col.key];
                            return (
                              <div key={col.key} style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isLocked}
                                  title={isLocked ? "Protégé par le backend (anti-élévation) pour ce rôle" : col.hint}
                                  onChange={() => toggleCapability(selectedRoleId, perm.id, col.key)}
                                  style={{ width: 18, height: 18, accentColor: GOLD, cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.4 : 1 }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {permissions.length === 0 && (
                  <div style={{ textAlign: "center", color: MUTED, padding: "48px" }}>
                    <AlertCircle size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p>Aucune permission définie dans le système.</p>
                  </div>
                )}
              </div>
              <div style={{ padding: "16px 24px", borderTop: `1px solid ${LINE}`, background: CREAM, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                {!hasChanges && <span style={{ fontSize: 12, color: MUTED }}>Aucune modification en attente</span>}
                <Button onClick={handleSave} disabled={saving || !hasChanges}>
                  <Save size={16} /> {saving ? "Sauvegarde…" : "Sauvegarder les modifications"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <RoleAssignabilityMatrix />
      </div>
    </div>
  );
}