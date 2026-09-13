import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Loader2, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import { NAVY, MUTED, LINE, CREAM, INK, GOLD } from "../lib/theme.js";
import Card from "../components/ui/Card.jsx";

export default function SuperAdminRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", description: "" });

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("roles").select("*").order("id");
      if (error) throw error;
      setRoles(data || []);
    } catch (e) {
      console.error("Erreur chargement rôles:", e);
      setMessage({ type: "error", text: "Impossible de charger les rôles." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        const { error } = await supabase.from("roles").update({ name: formData.name, description: formData.description }).eq("id", editingRole.id);
        if (error) throw error;
        setMessage({ type: "success", text: "Rôle mis à jour." });
      } else {
        const { error } = await supabase.from("roles").insert({ id: formData.id, name: formData.name, description: formData.description });
        if (error) throw error;
        setMessage({ type: "success", text: "Rôle créé." });
      }
      setShowModal(false);
      setEditingRole(null);
      setFormData({ id: "", name: "", description: "" });
      fetchRoles();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors de la sauvegarde." });
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Supprimer le rôle "${role.name}" ? Cette action est irréversible.`)) return;
    try {
      const { error } = await supabase.from("roles").delete().eq("id", role.id);
      if (error) throw error;
      setMessage({ type: "success", text: "Rôle supprimé." });
      fetchRoles();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData({ id: "", name: "", description: "" });
    setShowModal(true);
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setFormData({ id: role.id, name: role.name, description: role.description || "" });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRole(null);
    setFormData({ id: "", name: "", description: "" });
  };

  return (
    <div>
      <PageTitle
        title="Rôles"
        subtitle={loading ? "Chargement…" : `${roles.length} rôle${roles.length > 1 ? "s" : ""} configuré${roles.length > 1 ? "s" : ""}`}
        action={<Button onClick={openCreateModal}><Plus size={16} /> Nouveau rôle</Button>}
      />

      {message && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 8, background: message.type === "success" ? "#E3F0E4" : "#FAE8E6", color: message.type === "success" ? "#2E6B3C" : "#8A2B22", fontSize: 13 }}>
          {message.text}
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px", color: MUTED }}>
            <Loader2 size={24} className="spin" style={{ animation: "spin 1s linear infinite" }} /> Chargement…
          </div>
        ) : roles.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: MUTED }}>Aucun rôle configuré</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CREAM, borderBottom: `1px solid ${LINE}` }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>ID</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Nom</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Description</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: MUTED }}>{role.id}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: INK }}>
                      {role.name}
                      {role.id === "super_admin" && <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: GOLD, color: NAVY, fontWeight: 700 }}>SYSTEM</span>}
                    </td>
                    <td style={{ padding: "12px 16px", color: MUTED, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role.description || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button size="sm" variant="outline" onClick={() => openEditModal(role)}>
                          <Edit size={14} /> Modifier
                        </Button>
                        {role.id !== "super_admin" && (
                          <Button size="sm" variant="outline" onClick={() => handleDelete(role)} style={{ color: "#B5652E", borderColor: "#B5652E" }}>
                            <Trash2 size={14} /> Supprimer
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

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,26,40,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closeModal}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "24px", maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NAVY }}>{editingRole ? "Modifier le rôle" : "Nouveau rôle"}</h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: 16 }}>
                {!editingRole && (
                  <Field label="ID (unique, sans espaces)" value={formData.id} onChange={(e) => setFormData(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} required />
                )}
                <Field label="Nom affiché" value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} required />
                <Field label="Description" type="textarea" value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button>
                <Button type="submit"><Check size={14} /> {editingRole ? "Sauvegarder" : "Créer"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}