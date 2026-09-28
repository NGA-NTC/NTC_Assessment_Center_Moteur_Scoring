import { useEffect, useMemo } from "react";
import { Shield, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import { EmptyState, RowListSkeleton, TableSkeleton } from "../components/ui/States.jsx";
import { useAccessControl } from "../hooks/rbac/useAccessControl.js";
import RoleAssignabilityMatrix from "../components/admin/RoleAssignabilityMatrix.jsx";
import CheckboxField from "../components/common/CheckboxField.jsx";
import useMediaQuery from "../hooks/ui/useMediaQuery.js";

const CAPABILITY_COLUMNS = [
  { key: "use", label: "USE", hint: "Utilisation (consultation / exécution)" },
  { key: "manage", label: "MANAGE", hint: "Gestion (créer / modifier)" },
  { key: "grant", label: "GRANT", hint: "Accorder le droit à d'autres rôles ou utilisateurs" },
  { key: "delegate", label: "DELEGATE", hint: "Déléguer le droit (délégations)" },
];

const CAP_GRID_CLASS = "grid grid-cols-[minmax(0,1fr)_repeat(4,72px)] items-center gap-2";

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

  useEffect(() => {
    if (success) toast.success(success);
  }, [success]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

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

  // Desktop ≥768px : grille USE/MANAGE/GRANT/DELEGATE. Mobile : bloc empilé
  // par permission (aucun scroll horizontal).
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const renderPermRow = (perm) => {
    const caps = selectedRolePerms[perm.id] ?? {};
    const locked = lockedCap(perm.id);
    return (
      <div key={perm.id} className={`${CAP_GRID_CLASS} border-b border-border py-1.5 last:border-b-0`}>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground" title={perm.description || perm.id}>
            {perm.name}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">{perm.id}</div>
        </div>
        {CAPABILITY_COLUMNS.map((col) => {
          const isLocked = locked.includes(col.key);
          const checked = !!caps[col.key];
          return (
            <div key={col.key} className="flex justify-center">
              <CheckboxField
                ariaLabel={`${col.label} — ${perm.name}`}
                checked={checked}
                disabled={isLocked}
                title={isLocked ? "Protégé par le backend (anti-élévation) pour ce rôle" : col.hint}
                onCheckedChange={() => toggleCapability(selectedRoleId, perm.id, col.key)}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderPermCard = (perm) => {
    const caps = selectedRolePerms[perm.id] ?? {};
    const locked = lockedCap(perm.id);
    return (
      <div key={perm.id} className="mb-4 border-b border-border pb-4 last:mb-0 last:border-b-0 last:pb-0">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground" title={perm.description || perm.id}>
            {perm.name}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">{perm.id}</div>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {CAPABILITY_COLUMNS.map((col) => {
            const isLocked = locked.includes(col.key);
            return (
              <div key={col.key} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground" title={col.hint}>{col.label}</span>
                <CheckboxField
                  ariaLabel={`${col.label} — ${perm.name}`}
                  checked={!!caps[col.key]}
                  disabled={isLocked}
                  title={isLocked ? "Protégé par le backend (anti-élévation) pour ce rôle" : col.hint}
                  onCheckedChange={() => toggleCapability(selectedRoleId, perm.id, col.key)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden lg:sticky lg:top-[100px]">
          <div className="flex items-center justify-between border-b border-border bg-cream px-6 py-5">
            <div className="text-[16px] font-semibold text-foreground">Rôles</div>
            <Shield size={20} className="shrink-0 text-gold" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <RowListSkeleton count={5} />
            ) : roles.length === 0 ? (
              <EmptyState title="Aucun rôle" description="Aucun rôle n'est configuré." />
            ) : (
              <ul className="m-0 list-none p-0">
                {roles.map((role) => {
                  const isActive = selectedRoleId === role.id;
                  return (
                    <li key={role.id}>
                      <button
                        onClick={() => selectRole(role.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={
                          "w-full cursor-pointer border-none px-5 py-3.5 text-left font-sans text-[14px] transition-colors duration-150 " +
                          "border-l-[3px] " +
                          (isActive
                            ? "border-l-gold bg-muted font-semibold text-primary"
                            : "border-l-transparent bg-transparent font-medium text-ink")
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <Shield
                            size={18}
                            className={"shrink-0 " + (isActive ? "text-gold" : "text-muted-foreground")}
                          />
                          <span className="truncate">{role.name}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{role.id}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <div>
          {loading ? (
            <TableSkeleton columnCount={5} minHeight={240} />
          ) : !selectedRole ? (
            <Card className="p-12 text-center text-muted-foreground">
              <Shield size={48} className="mx-auto mb-4 opacity-30" />
              <p className="m-0 text-[16px]">Sélectionnez un rôle à gauche pour gérer ses accès</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-border bg-cream px-6 py-5">
                <div className="text-[16px] font-semibold text-foreground">
                  Permissions pour <span className="text-navy">{selectedRole.name}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-muted-foreground">
                  USE, MANAGE, GRANT et DELEGATE sont indépendants. Les changements ne sont appliqués qu'après sauvegarde.
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                {permissions.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <AlertCircle size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="m-0">Aucune permission définie dans le système.</p>
                  </div>
                ) : isDesktop ? (
                  <>
                    <div className={`${CAP_GRID_CLASS} mb-3 border-b border-border pb-2.5`}>
                      <div className="text-[11px] font-bold tracking-[0.5px] text-muted-foreground uppercase">
                        Permission
                      </div>
                      {CAPABILITY_COLUMNS.map((col) => (
                        <div key={col.key} className="text-center text-[12px] font-bold text-navy" title={col.hint}>
                          {col.label}
                        </div>
                      ))}
                    </div>
                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                      <div key={category} className="mb-5">
                        <div className="mb-2 border-b border-border pb-1.5 text-[11px] font-bold tracking-[0.5px] text-muted-foreground uppercase">
                          {category}
                        </div>
                        {perms.map(renderPermRow)}
                      </div>
                    ))}
                  </>
                ) : (
                  Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="mb-5">
                      <div className="mb-2 border-b border-border pb-1.5 text-[11px] font-bold tracking-[0.5px] text-muted-foreground uppercase">
                        {category}
                      </div>
                      {perms.map(renderPermCard)}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border bg-cream px-6 py-4">
                {!hasChanges && <span className="text-[12px] text-muted-foreground">Aucune modification en attente</span>}
                <Button onClick={handleSave} disabled={saving || !hasChanges}>
                  <Save size={16} /> {saving ? "Sauvegarde…" : "Sauvegarder les modifications"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6">
        <RoleAssignabilityMatrix />
      </div>
    </div>
  );
}
