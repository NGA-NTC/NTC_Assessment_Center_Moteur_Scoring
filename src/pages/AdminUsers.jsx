import { useState, useEffect, useCallback, useMemo } from "react";
import { MoreHorizontal } from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { useEffectiveAuthority } from "../hooks/auth/useEffectiveAuthority.js";
import {
  listUsers,
  assignRole,
  removeRole,
  updateUserActive,
} from "../services/auth/users/index.js";
import { listAssignableRoles } from "../services/rbac/assignableRoles/index.js";
import { listRoles } from "../services/rbac/roles/index.js";
import { userActions } from "../services/auth/users/actionAccess.js";
import AppShell from "../components/layout/AppShell.jsx";
import AppSidebar from "../components/layout/AppSidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import Badge from "../components/ui/Badge.jsx";
import Alert from "../components/ui/Alert.jsx";
import StatusBadge from "../components/common/StatusBadge.jsx";
import SearchInput from "../components/common/SearchInput.jsx";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import { LoadingState } from "../components/ui/States.jsx";
import AdminUserDetail from "./AdminUserDetail.jsx";

const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "neutral", suspended: "warning" };

const FILTER_SELECT_CLASS =
  "h-11 min-w-[160px] cursor-pointer rounded-sm border border-border bg-surface px-3 font-sans text-[13px] text-foreground outline-none";

export default function AdminUsers() {
  const { loading: adminLoading } = useAdminAuth();
  const { loading: authorityLoading, can } = useEffectiveAuthority();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [assignableRoleIds, setAssignableRoleIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirmUser, setConfirmUser] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const roleName = (roleId) => roleById.get(roleId)?.name ?? roleId;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, assignable, roleData] = await Promise.all([listUsers(), listAssignableRoles(), listRoles()]);
      setUsers(userData);
      setAssignableRoleIds((assignable ?? []).map((r) => r.assignable_role_id));
      setRoles(roleData);
    } catch (e) {
      console.error("Erreur chargement utilisateurs:", e);
      setMessage({ type: "error", text: "Impossible de charger les utilisateurs." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authorityLoading && userActions.canViewUsers(can)) {
      const t = setTimeout(() => { fetchUsers(); }, 0);
      return () => clearTimeout(t);
    }
  }, [fetchUsers, authorityLoading, can]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((u) =>
        (u.email?.toLowerCase().includes(q)) ||
        (u.first_name?.toLowerCase().includes(q)) ||
        (u.last_name?.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") result = result.filter((u) => u.status === statusFilter);
    if (roleFilter !== "all") result = result.filter((u) => u.role_ids?.includes(roleFilter));
    return result;
  }, [users, search, statusFilter, roleFilter]);

  const handleToggleStatus = (user) => {
    if (!userActions.canEditUser(can)) return;
    setConfirmUser(user);
  };

  const confirmStatusChange = async () => {
    if (!confirmUser || !userActions.canEditUser(can)) return;
    setConfirmBusy(true);
    const newStatus = confirmUser.status === "active" ? "inactive" : "active";
    try {
      await updateUserActive(confirmUser.id, newStatus !== "inactive");
      setUsers((prev) => prev.map((u) => u.id === confirmUser.id ? { ...u, status: newStatus } : u));
      setMessage({ type: "success", text: "Statut mis à jour." });
      setConfirmUser(null);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Erreur lors du changement de statut." });
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleRoleChange = async (userId, roleId, add) => {
    if (!userActions.canChangeRole(can)) return;
    try {
      if (add) {
        await assignRole(userId, roleId);
      } else {
        await removeRole(userId, roleId);
      }
      fetchUsers();
      setMessage({ type: "success", text: `Rôle ${add ? "ajouté" : "retiré"}.` });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Erreur lors de la modification du rôle." });
    }
  };

  if (adminLoading || authorityLoading) {
    return (
      <AppShell maxWidth={1000} sidebar={<AppSidebar />}>
        <LoadingState minHeight="60vh" />
      </AppShell>
    );
  }

  const canViewUsers = userActions.canViewUsers(can);

  return (
    <AppShell maxWidth={1000} sidebar={<AppSidebar />}>
      <PageTitle
        title="Administration des utilisateurs"
        subtitle={`${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? "s" : ""}`}
        right={
          <Button variant="outlineDark" size="sm" onClick={fetchUsers} disabled={loading || !canViewUsers}>
            {loading ? "Actualisation…" : "Actualiser"}
          </Button>
        }
      />
      {message && (
        <Alert type={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <div className="mb-5 rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Email, nom, prénom…" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrer par statut"
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="suspended">Suspendu</option>
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filtrer par rôle"
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">Tous les rôles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedUser ? (
        <AdminUserDetail
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleStatus={handleToggleStatus}
          onRoleChange={handleRoleChange}
          canManageRoles={userActions.canChangeRole(can)}
          assignableRoles={assignableRoleIds}
          roles={roles}
        />
      ) : !canViewUsers ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted-foreground">
          Vous n'avez pas la permission de consulter les utilisateurs (users.view requis).
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted-foreground">
          Aucun utilisateur ne correspond aux critères.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className="flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-border bg-surface p-3.5 text-left font-sans transition-colors duration-150 hover:border-gold2"
            >
              <Avatar
                name={`${u.first_name || ""} ${u.last_name || ""}`.trim()}
                email={u.email}
                size={42}
                gradient={(u.role_ids || []).some((r) => roleById.get(r)?.is_system)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-foreground">
                  {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.email}
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={u.status} labels={STATUS_LABELS} tones={STATUS_TONES} />
                {u.role_ids?.map((r) => (
                  <Badge key={r} tone={roleById.get(r)?.is_system ? "system" : "muted"}>{roleName(r)}</Badge>
                ))}
              </div>
              <MoreHorizontal size={16} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmUser}
        onCancel={() => setConfirmUser(null)}
        onConfirm={confirmStatusChange}
        loading={confirmBusy}
        title={confirmUser?.status === "active" ? "Désactiver l'utilisateur" : "Réactiver l'utilisateur"}
        description={confirmUser ? `${confirmUser.email} passera au statut « ${STATUS_LABELS[confirmUser.status === "active" ? "inactive" : "active"]} ». Continuer ?` : ""}
        confirmLabel={confirmUser?.status === "active" ? "Désactiver" : "Réactiver"}
        danger
      />
    </AppShell>
  );
}