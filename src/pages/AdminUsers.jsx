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
import { LoadingState } from "../components/ui/States.jsx";
import { colors, radius, type } from "../lib/theme.js";
import AdminUserDetail from "./AdminUserDetail.jsx";

const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "neutral", suspended: "warning" };

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

  const handleToggleStatus = async (user) => {
    if (!userActions.canEditUser(can)) return;
    const newStatus = user.status === "active" ? "inactive" : "active";
    if (!window.confirm(`Changer le statut de ${user.email} vers ${STATUS_LABELS[newStatus]} ?`)) return;
    try {
      await updateUserActive(user.id, newStatus !== "inactive");
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: newStatus } : u));
      setMessage({ type: "success", text: "Statut mis à jour." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Erreur lors du changement de statut." });
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

      <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: "16px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Email, nom, prénom…" />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrer par statut"
              style={{ padding: "10px 12px", minHeight: 44, border: `1px solid ${colors.border}`, borderRadius: radius.sm, fontSize: 13, background: "#fff", minWidth: 160, fontFamily: "inherit", color: colors.foreground }}
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
              style={{ padding: "10px 12px", minHeight: 44, border: `1px solid ${colors.border}`, borderRadius: radius.sm, fontSize: 13, background: "#fff", minWidth: 160, fontFamily: "inherit", color: colors.foreground }}
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
        <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: "40px", textAlign: "center", color: colors.mutedForeground }}>
          Vous n'avez pas la permission de consulter les utilisateurs (users.view requis).
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: "40px", textAlign: "center", color: colors.mutedForeground }}>
          Aucun utilisateur ne correspond aux critères.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                padding: "14px 16px",
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                background: "#fff",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: type.fontFamily.sans,
                transition: "border-color .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.gold2; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; }}
            >
              <Avatar
                name={`${u.first_name || ""} ${u.last_name || ""}`.trim()}
                email={u.email}
                size={42}
                gradient={(u.role_ids || []).some((r) => roleById.get(r)?.is_system)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.email}
                </div>
                <div style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>{u.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={u.status} labels={STATUS_LABELS} tones={STATUS_TONES} />
                {u.role_ids?.map((r) => (
                  <Badge key={r} tone={roleById.get(r)?.is_system ? "system" : "muted"}>{roleName(r)}</Badge>
                ))}
              </div>
              <MoreHorizontal size={16} color={colors.mutedForeground} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}