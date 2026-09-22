import { useState, useEffect, useCallback, useMemo } from "react";
import { UserPlus, Shield } from "lucide-react";
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
import Badge from "../components/ui/Badge.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import Modal from "../components/ui/Modal.jsx";
import Alert from "../components/ui/Alert.jsx";
import DataTable from "../components/common/DataTable.jsx";
import StatusBadge from "../components/common/StatusBadge.jsx";
import SearchInput from "../components/common/SearchInput.jsx";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import { useEffectiveAuthority } from "../hooks/auth/useEffectiveAuthority.js";
import { userActions } from "../services/auth/users/actionAccess.js";
import AdminUserDetail from "./AdminUserDetail.jsx";

const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "neutral", suspended: "warning" };

const FILTER_SELECT_CLASS =
  "h-11 w-full cursor-pointer rounded-sm border border-border bg-surface px-3 font-sans text-[14px] text-foreground outline-none";

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
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
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

  const requestToggleStatus = (user) => {
    if (!canEditUser) return;
    setConfirmTarget(user);
  };

  const confirmToggleStatus = async () => {
    if (!confirmTarget || !canEditUser) return;
    setConfirmBusy(true);
    try {
      const newStatus = confirmTarget.status === "active" ? "inactive" : "active";
      await updateUserActive(confirmTarget.id, newStatus !== "inactive");
      setMessage({ type: "success", text: `Utilisateur ${newStatus === "inactive" ? "suspendu" : "réactivé"}.` });
      setConfirmTarget(null);
      fetchUsers();
    } catch {
      setMessage({ type: "error", text: "Erreur lors du changement de statut." });
    } finally {
      setConfirmBusy(false);
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

  const columns = [
    { key: "user", label: "Utilisateur" },
    { key: "email", label: "Email" },
    { key: "roles", label: "Rôle(s)" },
    { key: "status", label: "Statut" },
    { key: "created", label: "Créé le" },
    { key: "actions", label: "Actions" },
  ];

  const renderCell = (user, col) => {
    switch (col.key) {
      case "user":
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={`${user.first_name || ""} ${user.last_name || ""}`.trim()} email={user.email} size={36} />
            <div>
              <div className="font-semibold text-foreground">{[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}</div>
              <div className="text-[11.5px] text-muted-foreground">{user.email}</div>
            </div>
          </div>
        );
      case "roles":
        return (
          <div className="flex flex-wrap gap-1.5">
            {(user.role_ids || []).map((r) => (
              <Badge key={r} tone={roleById.get(r)?.is_system ? "system" : "muted"}>{roleName(r)}</Badge>
            ))}
            {(user.role_ids || []).length === 0 && <span className="text-[11px] text-muted-foreground">Aucun rôle</span>}
          </div>
        );
      case "status":
        return <StatusBadge status={user.status} labels={STATUS_LABELS} tones={STATUS_TONES} />;
      case "created":
        return <span className="text-[12.5px] text-muted-foreground">{user.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR") : "—"}</span>;
      case "actions":
        return (
          <div className="flex flex-wrap gap-2">
            {canEditUser && (
              <Button size="sm" variant="outlineDark" onClick={(e) => { e.stopPropagation(); requestToggleStatus(user); }} disabled={loading}>
                {user.status === "active" ? "Suspendre" : "Réactiver"}
              </Button>
            )}
            {canChangeRole && (
              <Button size="sm" variant="outlineDark" onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }}>
                <Shield size={14} /> Rôle
              </Button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <PageTitle
        title="Comptes"
        subtitle={loading ? "Chargement…" : `${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? "s" : ""}`}
        right={
          canCreateUser && (
            <Button onClick={() => setShowCreateModal(true)}>
              <UserPlus size={16} /> Nouvel utilisateur
            </Button>
          )
        }
      />

      {message && (
        <Alert type={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher par nom, email…" />
        </div>
        <div className="min-w-[170px] max-w-[220px] flex-1">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={FILTER_SELECT_CLASS}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
            <option value="suspended">Suspendu</option>
          </select>
        </div>
        <div className="min-w-[170px] max-w-[220px] flex-1">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={FILTER_SELECT_CLASS}>
            <option value="all">Tous les rôles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredUsers}
        keyFor={(u) => u.id}
        renderCell={renderCell}
        loading={loading}
        emptyTitle="Aucun utilisateur trouvé"
        emptyDescription="Modifiez vos filtres ou créez un nouvel utilisateur."
      />

      {selectedUser && (
        <AdminUserDetail
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleStatus={requestToggleStatus}
          onRoleChange={handleRoleChange}
          canManageRoles={canChangeRole}
          assignableRoles={assignableRoleIds}
          roles={roles}
        />
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={confirmToggleStatus}
        loading={confirmBusy}
        title={confirmTarget?.status === "active" ? "Suspendre l'utilisateur" : "Réactiver l'utilisateur"}
        description={confirmTarget ? `${confirmTarget.email} sera ${confirmTarget.status === "active" ? "suspendu" : "réactivé"}. Continuer ?` : ""}
        confirmLabel={confirmTarget?.status === "active" ? "Suspendre" : "Réactiver"}
        danger
      />

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nouvel utilisateur" maxWidth={480}>
        <form onSubmit={handleCreateUser}>
          <div className="grid gap-1">
            <Field label="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required />
            <Field label="Mot de passe" type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required />
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
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
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>Annuler</Button>
            <Button type="submit"><UserPlus size={14} /> Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}