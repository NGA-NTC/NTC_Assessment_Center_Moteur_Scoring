import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Edit, Trash2, Loader2, Settings, Save, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import { NAVY, MUTED, LINE, CREAM, INK } from "../lib/theme.js";
import Card from "../components/ui/Card.jsx";

export default function SuperAdminFeatures() {
  const [pages, setPages] = useState([]);
  const [features, setFeatures] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", description: "", page_id: "", category: "", is_system: false });
  const [expandedPages, setExpandedPages] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesRes, featuresRes, pfRes] = await Promise.all([
        supabase.from("pages").select("id, name").order("name"),
        supabase.from("features").select("*").order("page_id, name"),
        supabase.from("page_features").select("page_id, feature_id"),
      ]);

      if (pagesRes.error) throw pagesRes.error;
      if (featuresRes.error) throw featuresRes.error;
      if (pfRes.error) throw pfRes.error;

      setPages(pagesRes.data || []);
      setFeatures(featuresRes.data || []);
    } catch (e) {
      console.error("Erreur chargement fonctionnalités:", e);
      setMessage({ type: "error", text: "Impossible de charger les données." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFeature) {
        const { error } = await supabase.from("features").update({ name: formData.name, description: formData.description, page_id: formData.page_id, category: formData.category }).eq("id", editingFeature.id);
        if (error) throw error;
        setMessage({ type: "success", text: "Fonctionnalité mise à jour." });
      } else {
        const { error } = await supabase.from("features").insert({ id: formData.id, name: formData.name, description: formData.description, page_id: formData.page_id, category: formData.category });
        if (error) throw error;
        setMessage({ type: "success", text: "Fonctionnalité créée." });
      }
      setShowModal(false);
      setEditingFeature(null);
      setFormData({ id: "", name: "", description: "", page_id: "", category: "", is_system: false });
      fetchData();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors de la sauvegarde." });
    }
  };

  const handleDelete = async (feature) => {
    if (feature.is_system) {
      setMessage({ type: "error", text: "Impossible de supprimer une fonctionnalité système." });
      return;
    }
    if (!window.confirm(`Supprimer la fonctionnalité "${feature.name}" ?`)) return;
    try {
      const { error } = await supabase.from("features").delete().eq("id", feature.id);
      if (error) throw error;
      setMessage({ type: "success", text: "Fonctionnalité supprimée." });
      fetchData();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    }
  };

  const openCreateModal = () => {
    setEditingFeature(null);
    setFormData({ id: "", name: "", description: "", page_id: pages[0]?.id || "", category: "", is_system: false });
    setShowModal(true);
  };

  const openEditModal = (feature) => {
    setEditingFeature(feature);
    setFormData({ id: feature.id, name: feature.name, description: feature.description || "", page_id: feature.page_id, category: feature.category || "", is_system: feature.is_system });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFeature(null);
    setFormData({ id: "", name: "", description: "", page_id: "", category: "", is_system: false });
  };

  const togglePageExpanded = (pageId) => {
    setExpandedPages(prev => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  const featuresByPage = useMemo(() => {
    const grouped = {};
    features.forEach(f => {
      if (!grouped[f.page_id]) grouped[f.page_id] = [];
      grouped[f.page_id].push(f);
    });
    return grouped;
  }, [features]);

  return (
    <div>
      <PageTitle
        title="Fonctionnalités"
        subtitle={loading ? "Chargement…" : `${features.length} fonctionnalité${features.length > 1 ? "s" : ""} définie${features.length > 1 ? "s" : ""}`}
        action={<Button onClick={openCreateModal}><Plus size={16} /> Nouvelle fonctionnalité</Button>}
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
          <div style={{ padding: "48px 24px", textAlign: "center", color: MUTED }}>
            <Settings size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Aucune page définie. Créez d'abord des pages dans la section « Pages ».</p>
          </div>
        ) : (
          <div>
            {pages.map(page => {
              const pageFeats = featuresByPage[page.id] || [];
              const isExpanded = expandedPages[page.id] !== false;
              return (
                <div key={page.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                  <button
                    onClick={() => togglePageExpanded(page.id)}
                    style={{
                      width: "100%", padding: "16px 24px", textAlign: "left", border: "none", background: CREAM,
                      cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: INK,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FileText size={20} color={NAVY} />
                      <span>{page.name}</span>
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#F0F0F0", color: MUTED }}>
                        {pageFeats.length} fonctionnalité{pageFeats.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp size={18} color={MUTED} /> : <ChevronDown size={18} color={MUTED} />}
                  </button>

                  {isExpanded && (
                    <div style={{ padding: "16px 24px 24px" }}>
                      {pageFeats.length === 0 ? (
                        <div style={{ textAlign: "center", color: MUTED, padding: "24px" }}>
                          Aucune fonctionnalité pour cette page.
                          <Button size="sm" variant="outline" onClick={() => { setFormData(f => ({ ...f, page_id: page.id })); openCreateModal(); }} style={{ marginLeft: 12 }}>
                            <Plus size={14} /> Ajouter
                          </Button>
                        </div>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: INK, fontSize: 11, textTransform: "uppercase" }}>Fonctionnalité</th>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: INK, fontSize: 11, textTransform: "uppercase" }}>Description</th>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: INK, fontSize: 11, textTransform: "uppercase" }}>Catégorie</th>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: INK, fontSize: 11, textTransform: "uppercase" }}>Type</th>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: INK, fontSize: 11, textTransform: "uppercase" }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageFeats.map(feature => (
                                <tr key={feature.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                                  <td style={{ padding: "10px 12px", fontWeight: 500, color: INK }}>{feature.name}</td>
                                  <td style={{ padding: "10px 12px", color: MUTED, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{feature.description || "—"}</td>
                                  <td style={{ padding: "10px 12px", fontSize: 11, color: MUTED }}>{feature.category || "—"}</td>
                                  <td style={{ padding: "10px 12px" }}>
                                    {feature.is_system ? (
                                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#FEF3E2", color: "#B5652E" }}>Système</span>
                                    ) : (
                                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#E3F0E4", color: "#2E6B3C" }}>Personnalisée</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "10px 12px" }}>
                                    <div style={{ display: "flex", gap: 8 }}>
                                      <Button size="sm" variant="outline" onClick={() => openEditModal(feature)}>
                                        <Edit size={14} /> Modifier
                                      </Button>
                                      {!feature.is_system && (
                                        <Button size="sm" variant="outline" onClick={() => handleDelete(feature)} style={{ color: "#B5652E", borderColor: "#B5652E" }}>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,26,40,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closeModal}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "24px", maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NAVY }}>{editingFeature ? "Modifier la fonctionnalité" : "Nouvelle fonctionnalité"}</h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: 16 }}>
                {!editingFeature && (
                  <Field label="ID (unique, sans espaces)" value={formData.id} onChange={(e) => setFormData(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} required />
                )}
                <Field label="Nom" value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} required />
                <Field label="Page parente" type="select" value={formData.page_id} onChange={(e) => setFormData(f => ({ ...f, page_id: e.target.value }))} required>
                  {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Field>
                <Field label="Description" type="textarea" value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} />
                <Field label="Catégorie" value={formData.category} onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))} placeholder="ex: lecture, écriture, admin" />
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button>
                <Button type="submit"><Save size={14} /> {editingFeature ? "Sauvegarder" : "Créer"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}