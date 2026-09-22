import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2, MoreHorizontal, CheckCircle2, AlertCircle } from "lucide-react";
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
import Field from "../components/ui/Field.jsx";
import { NAVY, MUTED, LINE, INK } from "../lib/theme.js";
import AdminUserDetail from "./AdminUserDetail.jsx";

const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "muted", suspended: "warning" };

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <Loader2 size={24} className="animate-spin" color={NAVY} />
        </div>
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
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading || !canViewUsers}>
            <Loader2 size={14} className={loading ? "animate-spin" : ""} /> Actualiser
          </Button>
        }
      />
      {message && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8, fontSize: 13,
          background: message.type === "success" ? "#E3F0E4" : "#FAE8E6",
          border: `1px solid ${message.type === "success" ? "#BFE0C4" : "#F5C6C3"}`,
          color: message.type === "success" ? "#2E6B3C" : "#8A2B22",
          display: "flex", alignItems: "center", gap: 8
        }}>
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
          <button onClick={() => setMessage(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Field
              label="Rechercher"
              placeholder="Email, nom, prénom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} color={MUTED} />}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, background: "#fff", minWidth: 160 }}>
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="suspended">Suspendu</option>
            </select>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, background: "#fff", minWidth: 160 }}>
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
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "40px", textAlign: "center", color: MUTED }}>
          Vous n'avez pas la permission de consulter les utilisateurs (users.view requis).
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "40px", textAlign: "center", color: MUTED }}>
          Aucun utilisateur ne correspond aux critères.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              style={{
                display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 16px",
                border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color .15s",
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                background: (u.role_ids || []).some((r) => roleById.get(r)?.is_system) ? "linear-gradient(135deg, #1B2A4A, #B8862B)" : NAVY,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14 }}>
                {(u.first_name?.[0] || "") + (u.last_name?.[0] || "") || u.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.email}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{u.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20,
                  background: STATUS_TONES[u.status] === "success" ? "#E3F0E4" : STATUS_TONES[u.status] === "warning" ? "#FEF3C7" : "#F3F4F6",
                  color: STATUS_TONES[u.status] === "success" ? "#2E6B3C" : STATUS_TONES[u.status] === "warning" ? "#92400E" : "#6B7280" }}>
                  {STATUS_LABELS[u.status] || "—"}
                </span>
                {u.role_ids?.map((r) => {
                  const isSystem = !!roleById.get(r)?.is_system;
                  return (
                    <span key={r} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20,
                      background: isSystem ? "#EDE9DC" : "#F3F4F6",
                      color: isSystem ? "#7A5A15" : "#374151", fontWeight: 600 }}>
                      {roleName(r)}
                    </span>
                  );
                })}
              </div>
              <MoreHorizontal size={16} color={MUTED} />
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}