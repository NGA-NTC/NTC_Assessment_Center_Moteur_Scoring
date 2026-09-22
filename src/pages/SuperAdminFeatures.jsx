import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Edit, Trash2, Settings, Save, ChevronDown, ChevronUp, FileText } from "lucide-react";
import {
  listFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
} from "../services/features/index.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Alert from "../components/ui/Alert.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import { EmptyState, LoadingState } from "../components/ui/States.jsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table.jsx";

export default function SuperAdminFeatures() {
  const [pages, setPages] = useState([]);
  const [features, setFeatures] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", description: "", page_id: "", category: "", is_system: false });
  const [expandedPages, setExpandedPages] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { pages, features } = await listFeatures();
      setPages(pages);
      setFeatures(features);
    } catch (e) {
      console.error("Erreur chargement fonctionnalités:", e);
      setMessage({ type: "error", text: "Impossible de charger les données." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { fetchData(); }, 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFeature) {
        await updateFeature(editingFeature.id, { name: formData.name, description: formData.description, page_id: formData.page_id, category: formData.category });
        setMessage({ type: "success", text: "Fonctionnalité mise à jour." });
      } else {
        await createFeature({ id: formData.id, name: formData.name, description: formData.description, page_id: formData.page_id, category: formData.category });
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.is_system) {
      setDeleteTarget(null);
      setMessage({ type: "error", text: "Impossible de supprimer une fonctionnalité système." });
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteFeature(deleteTarget.id);
      setMessage({ type: "success", text: "Fonctionnalité supprimée." });
      setDeleteTarget(null);
      fetchData();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    } finally {
      setDeleteBusy(false);
    }
  };

  const openCreateModal = (pageId) => {
    setEditingFeature(null);
    setFormData({ id: "", name: "", description: "", page_id: (pageId ?? pages[0]?.id) || "", category: "", is_system: false });
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

  const FEATURE_COLUMNS = [
    "Fonctionnalité",
    "Description",
    "Catégorie",
    "Type",
    "Actions",
  ];

  return (
    <div>
      <PageTitle
        title="Fonctionnalités"
        subtitle={loading ? "Chargement…" : `${features.length} fonctionnalité${features.length > 1 ? "s" : ""} définie${features.length > 1 ? "s" : ""}`}
        action={<Button onClick={openCreateModal}><Plus size={16} /> Nouvelle fonctionnalité</Button>}
      />

      {message && (
        <Alert type={message.type === "success" ? "success" : "error"}>
          {message.text}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <LoadingState minHeight={300} />
        ) : pages.length === 0 ? (
          <EmptyState
            icon={Settings}
            title="Aucune page définie"
            description="Créez d'abord des pages dans la section « Pages »."
          />
        ) : (
          <div>
            {pages.map(page => {
              const pageFeats = featuresByPage[page.id] || [];
              const isExpanded = expandedPages[page.id] !== false;
              return (
                <div key={page.id} className="border-b border-border last:border-b-0">
                  <button
                    onClick={() => togglePageExpanded(page.id)}
                    aria-expanded={isExpanded}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-cream px-6 py-4 text-left font-sans text-[14px] font-semibold text-foreground transition-colors hover:bg-cream"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileText size={20} className="shrink-0 text-navy" />
                      <span className="truncate">{page.name}</span>
                      <Badge tone="neutral">
                        {pageFeats.length} fonctionnalité{pageFeats.length > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={18} className="shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown size={18} className="shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 py-4 lg:px-6">
                      {pageFeats.length === 0 ? (
                        <div className="flex flex-wrap items-center justify-center gap-3 p-6 text-center text-muted-foreground">
                          Aucune fonctionnalité pour cette page.
                          <Button size="sm" variant="outline" onClick={() => openCreateModal(page.id)}>
                            <Plus size={14} /> Ajouter
                          </Button>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-border hover:bg-transparent">
                              {FEATURE_COLUMNS.map((col) => (
                                <TableHead key={col} className="px-3 py-2 text-[11px] font-bold tracking-[0.5px] text-muted-foreground uppercase first:pl-3 last:pr-3">
                                  {col}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageFeats.map(feature => (
                              <TableRow key={feature.id} className="border-b border-border">
                                <TableCell className="px-3 py-2.5 font-medium text-foreground">{feature.name}</TableCell>
                                <TableCell className="max-w-[300px] truncate px-3 py-2.5 text-muted-foreground">{feature.description || "—"}</TableCell>
                                <TableCell className="px-3 py-2.5 text-[11px] text-muted-foreground">{feature.category || "—"}</TableCell>
                                <TableCell className="px-3 py-2.5">
                                  {feature.is_system ? <Badge tone="warning">Système</Badge> : <Badge tone="success">Personnalisée</Badge>}
                                </TableCell>
                                <TableCell className="px-3 py-2.5">
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openEditModal(feature)}>
                                      <Edit size={14} /> Modifier
                                    </Button>
                                    {!feature.is_system && (
                                      <Button size="sm" variant="outlineDark" className="border-warning text-warning" onClick={() => setDeleteTarget(feature)}>
                                        <Trash2 size={14} /> Supprimer
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingFeature ? "Modifier la fonctionnalité" : "Nouvelle fonctionnalité"}
        maxWidth={560}
      >
        <form onSubmit={handleSubmit}>
          <div className="grid gap-1">
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
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button>
            <Button type="submit"><Save size={14} /> {editingFeature ? "Sauvegarder" : "Créer"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Supprimer la fonctionnalité"
        description={deleteTarget ? `Supprimer la fonctionnalité « ${deleteTarget.name} » ?` : ""}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}