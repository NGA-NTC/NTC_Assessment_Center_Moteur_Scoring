import { useState, useMemo } from "react";
import { ChevronLeft, Shield, Briefcase, Mail } from "lucide-react";
import { useEffectiveAuthority } from "../hooks/auth/useEffectiveAuthority.js";
import { userActions } from "../services/auth/users/actionAccess.js";
import { NAVY, GOLD, MUTED, LINE, CREAM, INK } from "../lib/theme.js";
import Button from "../components/ui/Button.jsx";

const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "muted", suspended: "warning" };

export default function AdminUserDetail({
  user,
  onClose,
  onToggleStatus,
  onRoleChange,
  canManageRoles,
  assignableRoles = [],
  roles = [],
}) {
  const [activeRoles, setActiveRoles] = useState((user.role_ids || []).slice());
  const { can } = useEffectiveAuthority();
  const canEdit = userActions.canEditUser(can);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const roleName = (roleId) => roleById.get(roleId)?.name ?? roleId;

  const handleStatusChange = () => {
    if (!canEdit) return;
    onToggleStatus(user);
  };

  const handleRoleToggle = (roleId) => {
    const add = !activeRoles.includes(roleId);
    onRoleChange(user.id, roleId, add);
    setActiveRoles((prev) => (add ? [...prev, roleId] : prev.filter((r) => r !== roleId)));
  };

  const roleRows = roles.map((role) => ({
    id: role.id,
    name: role.name,
    isSystem: !!role.is_system,
    addable: assignableRoles.includes(role.id),
    revocable: canManageRoles,
  }));

  const displayValue = (value) => value || "—";

  const infoCard = (title, icon) => (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {icon}
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, color: NAVY }}>{title}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { label: "Email", value: user.email },
          { label: "Téléphone", value: user.phone },
          { label: "Localisation", value: user.location },
        ].map((row) => (
          <div key={row.label}>
            <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>{row.label}</div>
            <div style={{ fontSize: 13.5, color: INK, wordBreak: "break-word" }}>{displayValue(row.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <button onClick={onClose} style={{
        display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
        color: MUTED, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 4, fontFamily: "inherit",
      }}>
        <ChevronLeft size={16} /> Retour à la liste
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, color: NAVY }}>
                {user.first_name || user.last_name ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : user.email}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{user.email}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20,
                background: STATUS_TONES[user.status] === "success" ? "#E3F0E4" : STATUS_TONES[user.status] === "warning" ? "#FEF3C7" : "#F3F4F6",
                color: STATUS_TONES[user.status] === "success" ? "#2E6B3C" : STATUS_TONES[user.status] === "warning" ? "#92400E" : "#6B7280", fontWeight: 600 }}>
                {STATUS_LABELS[user.status] || "—"}
              </span>
              {user.status !== "active" ? (
                <Button variant="outline" size="sm" onClick={handleStatusChange} disabled={!canEdit}>Réactiver</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleStatusChange} disabled={!canEdit}>Désactiver</Button>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 16, padding: "12px", background: CREAM, borderRadius: 8, border: `1px solid ${LINE}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Shield size={16} color={activeRoles.some((r) => roleById.get(r)?.is_system) ? GOLD : MUTED} />
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>Rôle(s)</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {activeRoles.length === 0 && <span style={{ fontSize: 11, color: MUTED }}>Aucun rôle actif</span>}
              {activeRoles.map((r) => {
                const isSystem = !!roleById.get(r)?.is_system;
                return (
                  <span key={r} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20,
                    background: isSystem ? "#EDE9DC" : "#F3F4F6",
                    color: isSystem ? "#7A5A15" : "#374151", fontWeight: 600 }}>
                    {roleName(r)}
                  </span>
                );
              })}
            </div>
          </div>

          {canManageRoles && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 8 }}>Attribuer / retirer des rôles</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {roleRows.map(({ id: r, name, isSystem, addable, revocable }) => {
                  const has = activeRoles.includes(r);
                  const disabled = has ? !revocable : !addable;
                  return (
                    <label key={r} style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "not-allowed" : "pointer", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={has}
                        onChange={() => handleRoleToggle(r)}
                        disabled={disabled}
                        title={disabled ? (has ? "Retrait réservé à un acteur disposant de users.change_role" : "Rôle non assignable par vos rôles actuels") : undefined}
                        style={{ width: 16, height: 16, accentColor: NAVY }}
                      />
                      <span style={{ fontWeight: has ? 600 : 400 }}>{name}</span>
                      {isSystem && <span style={{ fontSize: 11, color: MUTED }}>· rôle système</span>}
                    </label>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
                Ajout : rôle assignable par vos rôles · Retrait : capacité users.change_role requise.
              </div>
            </div>
          )}
        </div>

        {infoCard("Coordonnées", <Mail size={18} color={NAVY} />)}

        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Briefcase size={18} color={NAVY} />
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, color: NAVY }}>Informations professionnelles</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Fonction / Poste", value: user.job_title },
              { label: "LinkedIn", value: user.linkedin_url },
              { label: "Bio", value: user.bio },
            ].map((row) => (
              <div key={row.label}>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>{row.label}</div>
                <div style={{ fontSize: 13.5, color: INK, wordBreak: "break-word" }}>{displayValue(row.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}