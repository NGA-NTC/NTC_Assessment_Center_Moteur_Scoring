import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2, UserPlus, Shield, Edit } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import { NAVY, MUTED, LINE, CREAM, INK } from "../lib/theme.js";
import AdminUserDetail from "./AdminUserDetail.jsx";
import Card from "../components/ui/Card.jsx";

const ROLE_LABELS = { candidate: "Candidat", admin: "Administrateur", super_admin: "Super Administrateur" };
const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "muted", suspended: "warning" };

export default function SuperAdminAccounts() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", first_name: "", last_name: "", role: "candidate", status: "active" });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_users");
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error("Erreur chargement utilisateurs:", e);
      setMessage({ type: "error", text: "Impossible de charger les utilisateurs." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, []);

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
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: createForm.email,
        password: createForm.password,
        email_confirm: true,
        user_metadata: { first_name: createForm.first_name, last_name: createForm.last_name },
      });
      if (error) throw error;
      
      if (createForm.role) {
        await supabase.from("user_roles").insert({ user_id: data.user.id, role_id: createForm.role });
      }
      
      if (createForm.status === "inactive") {
        await supabase.auth.admin.updateUserById(data.user.id, { ban_duration: "87600h" });
      }
      
      setMessage({ type: "success", text: "Utilisateur créé avec succès." });
      setShowCreateModal(false);
      setCreateForm({ email: "", password: "", first_name: "", last_name: "", role: "candidate", status: "active" });
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors de la création." });
    }
  };

  const handleResetPassword = async (userId, email) => {
    if (!window.confirm(`Envoyer un email de réinitialisation de mot de passe à ${email} ?`)) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ target_user_id: userId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur lors de l'envoi");
      setMessage({ type: "success", text: "Email de réinitialisation envoyé." });
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'envoi de l'email." });
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${newStatus === "inactive" ? "Suspendre" : "Réactiver"} cet utilisateur ?`)) return;
    try {
      if (newStatus === "inactive") {
        await supabase.auth.admin.updateUserById(user.id, { ban_duration: "87600h" });
      } else {
        await supabase.auth.admin.updateUserById(user.id, { ban_duration: "none" });
      }
      setMessage({ type: "success", text: `Utilisateur ${newStatus === "inactive" ? "suspendu" : "réactivé"}.` });
      fetchUsers();
    } catch {
      setMessage({ type: "error", text: "Erreur lors du changement de statut." });
    }
  };

  const handleRoleChange = async (userId, newRoleId) => {
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      if (newRoleId) {
        await supabase.from("user_roles").insert({ user_id: userId, role_id: newRoleId });
      }
      setMessage({ type: "success", text: "Rôle mis à jour." });
      fetchUsers();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la mise à jour du rôle." });
    }
  };

  return (
    <div>
      <PageTitle
        title="Comptes"
        subtitle={loading ? "Chargement…" : `${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? "s" : ""}`}
        action={
          <Button onClick={() => setShowCreateModal(true)}>
            <UserPlus size={16} /> Nouvel utilisateur
          </Button>
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
              <option value="candidate">Candidat</option>
              <option value="admin">Administrateur</option>
              <option value="super_admin">Super Administrateur</option>
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
                          <span key={r} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#F0F0F0", color: INK }}>
                            {ROLE_LABELS[r] || r}
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
                        {STATUS_LABELS[user.status] || user.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: MUTED, fontSize: 12.5 }}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button size="sm" variant="outline" onClick={() => handleResetPassword(user.id, user.email)} disabled={loading}>
                          <Edit size={14} /> MDP
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleToggleStatus(user)} disabled={loading}>
                          {user.status === "active" ? "Suspendre" : "Réactiver"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSelectedUser(user)}>
                          <Shield size={14} /> Rôle
                        </Button>
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
          onResetPassword={handleResetPassword}
          onToggleStatus={handleToggleStatus}
          onRoleChange={handleRoleChange}
          canManageRoles={true}
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
                <Field label="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} required />
                <Field label="Mot de passe" type="password" value={createForm.password} onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))} required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Prénom" value={createForm.first_name} onChange={(e) => setCreateForm(f => ({ ...f, first_name: e.target.value }))} />
                  <Field label="Nom" value={createForm.last_name} onChange={(e) => setCreateForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
                <Field label="Rôle" type="select" value={createForm.role} onChange={(e) => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="candidate">Candidat</option>
                  <option value="admin">Administrateur</option>
                  <option value="super_admin">Super Administrateur</option>
                </Field>
                <Field label="Statut" type="select" value={createForm.status} onChange={(e) => setCreateForm(f => ({ ...f, status: e.target.value }))}>
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