import { useState, useMemo } from "react";
import { ChevronLeft, Shield, Briefcase, Mail } from "lucide-react";
import { useEffectiveAuthority } from "../hooks/auth/useEffectiveAuthority.js";
import { userActions } from "../services/auth/users/actionAccess.js";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";
import Card from "../components/ui/Card.jsx";

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

  const infoRow = (row) => (
    <div key={row.label}>
      <div className="mb-1 text-[11px] tracking-[0.4px] text-muted-foreground uppercase">{row.label}</div>
      <div className="text-[13.5px] break-words text-foreground">{displayValue(row.value)}</div>
    </div>
  );

  const infoCard = (title, icon) => (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <div className="font-serif text-[16px] font-semibold text-navy">{title}</div>
      </div>
      <div className="flex flex-col gap-3">
        {[
          { label: "Email", value: user.email },
          { label: "Téléphone", value: user.phone },
          { label: "Localisation", value: user.location },
        ].map(infoRow)}
      </div>
    </Card>
  );

  const statusTone = STATUS_TONES[user.status] || "muted";

  return (
    <div className="flex flex-col">
      <button
        onClick={onClose}
        className="mb-1 inline-flex w-fit cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 font-sans text-[13px] text-muted-foreground"
      >
        <ChevronLeft size={16} /> Retour à la liste
      </button>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-serif text-[18px] font-semibold text-navy break-words">
                {user.first_name || user.last_name ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : user.email}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">{user.email}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={statusTone}>{STATUS_LABELS[user.status] || "—"}</Badge>
              {user.status !== "active" ? (
                <Button variant="outline" size="sm" onClick={handleStatusChange} disabled={!canEdit}>
                  Réactiver
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleStatusChange} disabled={!canEdit}>
                  Désactiver
                </Button>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-md border border-border bg-cream p-3">
            <div className="mb-2 flex items-center gap-2">
              <Shield
                size={16}
                className={activeRoles.some((r) => roleById.get(r)?.is_system) ? "text-gold" : "text-muted-foreground"}
              />
              <div className="text-[11px] tracking-[0.4px] text-muted-foreground uppercase">Rôle(s)</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeRoles.length === 0 && <span className="text-[11px] text-muted-foreground">Aucun rôle actif</span>}
              {activeRoles.map((r) => {
                const isSystem = !!roleById.get(r)?.is_system;
                return (
                  <Badge key={r} tone={isSystem ? "system" : "muted"}>
                    {roleName(r)}
                  </Badge>
                );
              })}
            </div>
          </div>

          {canManageRoles && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-2 text-[11px] tracking-[0.4px] text-muted-foreground uppercase">
                Attribuer / retirer des rôles
              </div>
              <div className="flex flex-col gap-1.5">
                {roleRows.map(({ id: r, name, isSystem, addable, revocable }) => {
                  const has = activeRoles.includes(r);
                  const disabled = has ? !revocable : !addable;
                  return (
                    <label
                      key={r}
                      className="flex items-center gap-2 text-[13px]"
                      style={{ cursor: disabled ? "not-allowed" : "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={has}
                        onChange={() => handleRoleToggle(r)}
                        disabled={disabled}
                        title={disabled ? (has ? "Retrait réservé à un acteur disposant de users.change_role" : "Rôle non assignable par vos rôles actuels") : undefined}
                        className="h-4 w-4 accent-navy"
                      />
                      <span className={has ? "font-semibold" : "font-normal"}>{name}</span>
                      {isSystem && <span className="text-[11px] text-muted-foreground">· rôle système</span>}
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Ajout : rôle assignable par vos rôles · Retrait : capacité users.change_role requise.
              </div>
            </div>
          )}
        </Card>

        {infoCard("Coordonnées", <Mail size={18} className="text-navy" />)}

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase size={18} className="text-navy" />
            <div className="font-serif text-[16px] font-semibold text-navy">Informations professionnelles</div>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { label: "Fonction / Poste", value: user.job_title },
              { label: "LinkedIn", value: user.linkedin_url },
              { label: "Bio", value: user.bio },
            ].map(infoRow)}
          </div>
        </Card>
      </div>
    </div>
  );
}