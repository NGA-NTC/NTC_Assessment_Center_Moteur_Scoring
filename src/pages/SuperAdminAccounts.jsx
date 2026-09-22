import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2, UserPlus, Shield } from "lucide-react";
import {
  listUsers,
  createUserAccount,
  updateUserActive,
  assignRole,
  removeRole,
} from "../services/auth/users/index.js";
import { listAssignableRoles } from "../services/rbac/assignableRoles/index.js";
import { listRoles } from "../services/rbac/roles/index.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import { useEffectiveAuthority } from "../hooks/auth/useEffectiveAuthority.js";
import { userActions } from "../services/auth/users/actionAccess.js";
import { NAVY, MUTED, LINE, CREAM, INK } from "../lib/theme.js";
import AdminUserDetail from "./AdminUserDetail.jsx";
import Card from "../components/ui/Card.jsx";

const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "muted", suspended: "warning" };

export default function SuperAdminAccounts() {
  const { can } = useEffectiveAuthority();
  const canCreateUser = userActions.canCreateUser(can);
  const canEditUser = userActions.canEditUser(can);
  const canChangeRole = userActions.canChangeRole(can);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [assignableRoleIds, setAssignableRoleIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", first_name: "", last_name: "", role: "candidate", status: "active" });

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const roleName = (roleId) => roleById.get(roleId)?.name ?? roleId;
  const initialRoleOptions = useMemo(
    () => roles.filter((r) => assignableRoleIds.includes(r.id)),
    [roles, assignableRoleIds]
  );

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
    const t = setTimeout(() => { fetchUsers(); }, 0);
    return () => clearTimeout(t);
  }, [fetchUsers]);

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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!canCreateUser) return;
    try {
      await createUserAccount({
        email: createForm.email,
        password: createForm.password,
        firstName: createForm.first_name,
        lastName: createForm.last_name,
        role: createForm.role,
        status: createForm.status,
      });

      setMessage({ type: "success", text: "Utilisateur créé avec succès." });
      setShowCreateModal(false);
      setCreateForm({ email: "", password: "", first_name: "", last_name: "", role: "candidate", status: "active" });
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors de la création." });
    }
  };

  const handleToggleStatus = async (user) => {
    if (!canEditUser) return;
    const newStatus = user.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${newStatus === "inactive" ? "Suspendre" : "Réactiver"} cet utilisateur ?`)) return;
    try {
      await updateUserActive(user.id, newStatus !== "inactive");
      setMessage({ type: "success", text: `Utilisateur ${newStatus === "inactive" ? "suspendu" : "réactivé"}.` });
      fetchUsers();
    } catch {
      setMessage({ type: "error", text: "Erreur lors du changement de statut." });
    }
  };

  const handleRoleChange = async (userId, roleId, add) => {
    if (!canChangeRole) return;
    try {
      if (add) {
        await assignRole(userId, roleId);
      } else {
        await removeRole(userId, roleId);
      }
      setMessage({ type: "success", text: `Rôle ${add ? "ajouté" : "retiré"}.` });
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors de la mise à jour du rôle." });
    }
  };

  return (
    <div>
      <PageTitle
        title="Comptes"
        subtitle={loading ? "Chargement…" : `${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? "s" : ""}`}
        action={
          canCreateUser && (
            <Button onClick={() => setShowCreateModal(true)}>
              <UserPlus size={16} /> Nouvel utilisateur
            </Button>
          )
        }
      />

      {message && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 8, background: message.type === "success" ? "#E3F0E4" : "#FAE8E6", color: message.type === "success" ? "#2E6B3C" : "#8A2B22", fontSize: 13 }}>
          {message.text}
        </div>
      )}

      <Card style={{ padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Rechercher" placeholder="Nom, email…" value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search size={16} color={MUTED} />} />
          </div>
          <div style={{ minWidth: 160 }}>
            <Field label="Statut" type="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="suspended">Suspendu</option>
            </Field>
          </div>
          <div style={{ minWidth: 160 }}>
            <Field label="Rôle" type="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">Tous les rôles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Field>
          </div>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px", color: MUTED }}>
            <Loader2 size={24} className="spin" style={{ animation: "spin 1s linear infinite" }} /> Chargement…
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: MUTED }}>Aucun utilisateur trouvé</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CREAM, borderBottom: `1px solid ${LINE}` }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Utilisateur</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Email</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Rôle(s)</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Statut</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Créé le</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                          {(user.first_name?.[0] || user.last_name?.[0] || user.email?.[0] || "U").toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: INK }}>{[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}</div>
                          <div style={{ fontSize: 11.5, color: MUTED }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", color: INK }}>{user.email}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(user.role_ids || []).map((r) => (
                          <span key={r} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: roleById.get(r)?.is_system ? "#EDE9DC" : "#F0F0F0", color: roleById.get(r)?.is_system ? "#7A5A15" : INK }}>
                              {roleName(r)}
                            </span>
                        ))}
                        {(user.role_ids || []).length === 0 && <span style={{ fontSize: 11, color: MUTED }}>Aucun rôle</span>}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 999,
                        background: STATUS_TONES[user.status] === "success" ? "#E3F0E4" : STATUS_TONES[user.status] === "warning" ? "#FEF3E2" : "#FAE8E6",
                        color: STATUS_TONES[user.status] === "success" ? "#2E6B3C" : STATUS_TONES[user.status] === "warning" ? "#B5652E" : "#8A2B22",
                      }}>
                        {STATUS_LABELS[user.status] || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: MUTED, fontSize: 12.5 }}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {canEditUser && (
                          <Button size="sm" variant="outline" onClick={() => handleToggleStatus(user)} disabled={loading}>
                            {user.status === "active" ? "Suspendre" : "Réactiver"}
                          </Button>
                        )}
                        {canChangeRole && (
                          <Button size="sm" variant="outline" onClick={() => setSelectedUser(user)}>
                            <Shield size={14} /> Rôle
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedUser && (
        <AdminUserDetail
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleStatus={handleToggleStatus}
          onRoleChange={handleRoleChange}
          canManageRoles={canChangeRole}
          assignableRoles={assignableRoleIds}
          roles={roles}
        />
      )}

      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,26,40,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowCreateModal(false)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "24px", maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NAVY }}>Nouvel utilisateur</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED }}>×</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: "grid", gap: 16 }}>
                <Field label="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required />
                <Field label="Mot de passe" type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Prénom" value={createForm.first_name} onChange={(e) => setCreateForm((f) => ({ ...f, first_name: e.target.value }))} />
                  <Field label="Nom" value={createForm.last_name} onChange={(e) => setCreateForm((f) => ({ ...f, last_name: e.target.value }))} />
                </div>
                <Field label="Rôle initial" type="select" value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}>
                  {initialRoleOptions.length === 0 && <option value="">Aucun rôle assignable</option>}
                  {initialRoleOptions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Field>
                <Field label="Statut" type="select" value={createForm.status} onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </Field>
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>Annuler</Button>
                <Button type="submit"><UserPlus size={14} /> Créer</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}