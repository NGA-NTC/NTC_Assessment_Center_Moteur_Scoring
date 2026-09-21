import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Loader2, FileText, Save } from "lucide-react";
import {
  listPages,
  createPage,
  updatePage,
  deletePage,
} from "../services/pages/index.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import { NAVY, MUTED, LINE, CREAM, INK } from "../lib/theme.js";
import Card from "../components/ui/Card.jsx";

const DEFAULT_PAGES = [
  { id: "dashboard", name: "Tableau de bord", path: "/", description: "Page d'accueil après connexion", icon: "LayoutDashboard" },
  { id: "test", name: "Évaluation", path: "/test", description: "Passer les batteries de tests", icon: "ClipboardCheck" },
  { id: "results", name: "Mes résultats", path: "/resultats", description: "Voir ses propres résultats", icon: "BarChart2" },
  { id: "profile", name: "Mon compte", path: "/compte", description: "Profil et préférences personnelles", icon: "User" },
  { id: "password", name: "Mot de passe", path: "/modifier-mot-de-passe", description: "Changer son mot de passe", icon: "Lock" },
  { id: "admin-dashboard", name: "Admin - Tableau de bord", path: "/admin", description: "Dashboard administrateur (résultats)", icon: "LayoutDashboard" },
  { id: "admin-users", name: "Admin - Utilisateurs", path: "/admin/utilisateurs", description: "Gestion des utilisateurs", icon: "Users" },
  { id: "super-admin", name: "Super Admin - Dashboard", path: "/super-admin", description: "Back-office global Super Admin", icon: "Shield" },
  { id: "super-admin-accounts", name: "Super Admin - Comptes", path: "/super-admin/comptes", description: "Gestion de tous les comptes", icon: "Users" },
  { id: "super-admin-roles", name: "Super Admin - Rôles", path: "/super-admin/roles", description: "Gestion des rôles", icon: "Shield" },
  { id: "super-admin-access", name: "Super Admin - Accès", path: "/super-admin/acces", description: "Gestion des permissions par rôle", icon: "Key" },
  { id: "super-admin-pages", name: "Super Admin - Pages", path: "/super-admin/pages", description: "Gestion des pages accessibles", icon: "FileText" },
  { id: "super-admin-features", name: "Super Admin - Fonctionnalités", path: "/super-admin/fonctionnalites", description: "Gestion des fonctionnalités par page", icon: "Settings" },
];

export default function SuperAdminPages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", path: "", description: "", icon: "", is_system: false });

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPages();
      setPages(data ?? DEFAULT_PAGES);
    } catch (e) {
      console.error("Erreur chargement pages:", e);
      setPages(DEFAULT_PAGES);
      if (e?.code !== "42P01") {
        setMessage({ type: "error", text: "Impossible de charger les pages depuis la base, affichage des pages par défaut." });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPage) {
        await updatePage(editingPage.id, { name: formData.name, path: formData.path, description: formData.description, icon: formData.icon });
        setMessage({ type: "success", text: "Page mise à jour." });
      } else {
        await createPage({ id: formData.id, name: formData.name, path: formData.path, description: formData.description, icon: formData.icon });
        setMessage({ type: "success", text: "Page créée." });
      }
      setShowModal(false);
      setEditingPage(null);
      setFormData({ id: "", name: "", path: "", description: "", icon: "", is_system: false });
      fetchPages();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors de la sauvegarde." });
    }
  };

  const handleDelete = async (page) => {
    if (page.is_system) {
      setMessage({ type: "error", text: "Impossible de supprimer une page système." });
      return;
    }
    if (!window.confirm(`Supprimer la page "${page.name}" ? Cette action est irréversible.`)) return;
    try {
      await deletePage(page.id);
      setMessage({ type: "success", text: "Page supprimée." });
      fetchPages();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  };

  const openCreateModal = () => {
    setEditingPage(null);
    setFormData({ id: "", name: "", path: "", description: "", icon: "", is_system: false });
    setShowModal(true);
  };

  const openEditModal = (page) => {
    setEditingPage(page);
    setFormData({ id: page.id, name: page.name, path: page.path, description: page.description || "", icon: page.icon || "", is_system: page.is_system });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPage(null);
    setFormData({ id: "", name: "", path: "", description: "", icon: "", is_system: false });
  };

  return (
    <div>
      <PageTitle
        title="Pages"
        subtitle={loading ? "Chargement…" : `${pages.length} page${pages.length > 1 ? "s" : ""} gérée${pages.length > 1 ? "s" : ""}`}
        action={<Button onClick={openCreateModal}><Plus size={16} /> Nouvelle page</Button>}
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
        ) : pages.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: MUTED }}>Aucune page définie</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: CREAM, borderBottom: `1px solid ${LINE}` }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Page</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Chemin</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Description</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Type</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: INK }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(page => (
                  <tr key={page.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <FileText size={18} />
                        </div>
                        <div style={{ fontWeight: 600, color: INK }}>{page.name}</div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: MUTED }}>{page.path}</td>
                    <td style={{ padding: "12px 16px", color: MUTED, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.description || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {page.is_system ? (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#FEF3E2", color: "#B5652E" }}>Système</span>
                      ) : (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#E3F0E4", color: "#2E6B3C" }}>Personnalisée</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button size="sm" variant="outline" onClick={() => openEditModal(page)}>
                          <Edit size={14} /> Modifier
                        </Button>
                        {!page.is_system && (
                          <Button size="sm" variant="outline" onClick={() => handleDelete(page)} style={{ color: "#B5652E", borderColor: "#B5652E" }}>
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
          <div style={{ background: "#fff", borderRadius: 14, padding: "24px", maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NAVY }}>{editingPage ? "Modifier la page" : "Nouvelle page"}</h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: 16 }}>
                {!editingPage && (
                  <Field label="ID (unique, sans espaces)" value={formData.id} onChange={(e) => setFormData(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} required />
                )}
                <Field label="Nom affiché" value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} required />
                <Field label="Chemin (route)" value={formData.path} onChange={(e) => setFormData(f => ({ ...f, path: e.target.value }))} placeholder="/ma-page" required />
                <Field label="Description" type="textarea" value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} />
                <Field label="Icône (nom Lucide)" value={formData.icon} onChange={(e) => setFormData(f => ({ ...f, icon: e.target.value }))} placeholder="FileText" />
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button>
                <Button type="submit"><Save size={14} /> {editingPage ? "Sauvegarder" : "Créer"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}