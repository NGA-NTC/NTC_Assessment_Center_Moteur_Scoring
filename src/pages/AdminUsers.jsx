import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2, MoreHorizontal, CheckCircle2, AlertCircle } from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import AppShell from "../components/layout/AppShell.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import { NAVY, MUTED, LINE, CREAM, INK, GOLD } from "../lib/theme.js";
import AdminUserDetail from "./AdminUserDetail.jsx";

const ROLE_LABELS = { candidate: "Candidat", admin: "Administrateur", super_admin: "Super Administrateur" };
const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "muted", suspended: "warning" };

export default function AdminUsers() {
  const { adminUser, loading: adminLoading } = useAdminAuth();
  const { hasPermission } = useUserAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState(null);

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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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

  const handleView = (user) => setSelectedUser(user);
  const handleCloseDetail = () => setSelectedUser(null);

  const handleResetPassword = async (userId, email) => {
    if (!window.confirm(`Envoyer un email de réinitialisation de mot de passe à ${email} ?`)) return;
    try {
      const redirectTo = `${window.location.origin}/reinitialiser-mot-de-passe`;
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
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Erreur lors de l'envoi de l'email." });
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    if (!window.confirm(`Changer le statut de ${user.email} vers ${STATUS_LABELS[newStatus]} ?`)) return;
    try {
      const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", user.id);
      if (error) throw error;
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: newStatus } : u));
      setMessage({ type: "success", text: "Statut mis à jour." });
    } catch (e) {
      setMessage({ type: "error", text: "Erreur lors du changement de statut." });
    }
  };

  const handleRoleChange = async (userId, roleId, add) => {
    if (!hasPermission("users.change_role")) return;
    try {
      if (add) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role_id: roleId, assigned_by: adminUser.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role_id", roleId);
        if (error) throw error;
      }
      fetchUsers();
      setMessage({ type: "success", text: `Rôle ${add ? "ajouté" : "retiré"}.` });
    } catch (e) {
      setMessage({ type: "error", text: "Erreur lors de la modification du rôle." });
    }
  };

  if (adminLoading) {
    return (
      <AppShell maxWidth={1000} sidebar={<div />}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <Loader2 size={24} className="animate-spin" color={NAVY} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={1000} sidebar={<div />}>
      <PageTitle
        title="Administration des utilisateurs"
        subtitle={`${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? "s" : ""}`}
        right={
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
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
              <option value="candidate">Candidat</option>
              <option value="admin">Administrateur</option>
              <option value="super_admin">Super Administrateur</option>
            </select>
          </div>
        </div>
      </div>

      {selectedUser ? (
        <AdminUserDetail
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onResetPassword={handleResetPassword}
          onToggleStatus={handleToggleStatus}
          onRoleChange={handleRoleChange}
          canManageRoles={hasPermission("users.change_role")}
        />
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
                background: (u.role_ids?.includes("admin") || u.role_ids?.includes("super_admin")) ? "linear-gradient(135deg, #1B2A4A, #B8862B)" : NAVY,
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
                  {STATUS_LABELS[u.status] || u.status}
                </span>
                {u.role_ids?.map((r) => (
                  <span key={r} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20,
                    background: r === "admin" ? "#EDE9DC" : r === "super_admin" ? "#EDE9DC" : "#F3F4F6",
                    color: r === "admin" ? "#7A5A15" : r === "super_admin" ? "#7A5A15" : "#374151", fontWeight: 600 }}>
                    {ROLE_LABELS[r] || r}
                  </span>
                ))}
              </div>
              <MoreHorizontal size={16} color={MUTED} />
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}