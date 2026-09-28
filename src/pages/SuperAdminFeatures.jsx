import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Edit, Trash2, Settings, Save, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  listFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
} from "../services/features/index.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import Badge from "../components/ui/Badge.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import ResponsiveDataTable from "../components/common/ResponsiveDataTable.jsx";
import { TableSkeleton } from "../components/ui/States.jsx";

export default function SuperAdminFeatures() {
  const [pages, setPages] = useState([]);
  const [features, setFeatures] = useState([]);

  const [loading, setLoading] = useState(true);
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
      toast.error("Impossible de charger les données.");
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
        toast.success("Fonctionnalité mise à jour.");
      } else {
        await createFeature({ id: formData.id, name: formData.name, description: formData.description, page_id: formData.page_id, category: formData.category });
        toast.success("Fonctionnalité créée.");
      }
      setShowModal(false);
      setEditingFeature(null);
      setFormData({ id: "", name: "", description: "", page_id: "", category: "", is_system: false });
      fetchData();
    } catch (e) {
      toast.error(e.message || "Erreur lors de la sauvegarde.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.is_system) {
      setDeleteTarget(null);
      toast.error("Impossible de supprimer une fonctionnalité système.");
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteFeature(deleteTarget.id);
      toast.success("Fonctionnalité supprimée.");
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error("Erreur lors de la suppression.");
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

  const featureActions = (feature) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditModal(feature); }}>
        <Edit size={14} /> Modifier
      </Button>
      {!feature.is_system && (
        <Button size="sm" variant="outlineDark" className="border-warning text-warning" onClick={(e) => { e.stopPropagation(); setDeleteTarget(feature); }}>
          <Trash2 size={14} /> Supprimer
        </Button>
      )}
    </div>
  );

  const FEATURE_COLUMNS = [
    { key: "name", label: "Fonctionnalité" },
    { key: "description", label: "Description" },
    { key: "category", label: "Catégorie" },
    { key: "type", label: "Type" },
    { key: "actions", label: "Actions" },
  ];

  const renderFeatureCell = (feature, col) => {
    switch (col.key) {
      case "name":
        return <span className="font-medium text-foreground">{feature.name}</span>;
      case "description":
        return <span className="block max-w-[300px] truncate text-muted-foreground">{feature.description || "—"}</span>;
      case "category":
        return <span className="text-[11px] text-muted-foreground">{feature.category || "—"}</span>;
      case "type":
        return feature.is_system ? <Badge tone="warning">Système</Badge> : <Badge tone="success">Personnalisée</Badge>;
      case "actions":
        return featureActions(feature);
      default:
        return null;
    }
  };

  return (
    <div>
      <PageTitle
        title="Fonctionnalités"
        subtitle={loading ? "Chargement…" : `${features.length} fonctionnalité${features.length > 1 ? "s" : ""} définie${features.length > 1 ? "s" : ""}`}
        action={<Button onClick={() => openCreateModal()}><Plus size={16} /> Nouvelle fonctionnalité</Button>}
      />

      {loading ? (
        <TableSkeleton columnCount={5} minHeight={300} />
      ) : (
        pages.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <div className="p-12 text-center text-muted-foreground">
              <Settings size={48} className="mx-auto mb-4 opacity-30" />
              <div className="text-sm font-semibold text-foreground">Aucune page définie</div>
              <div className="mt-1 text-[12.5px]">Créez d'abord des pages dans la section « Pages ».</div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-card">
            {pages.map(page => {
              const pageFeats = featuresByPage[page.id] || [];
              const isExpanded = expandedPages[page.id] !== false;
              return (
                <div key={page.id} className="border-b border-border last:border-b-0">
                  <button
                    onClick={() => togglePageExpanded(page.id)}
                    aria-expanded={isExpanded}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-t-xl border-none bg-cream px-6 py-4 text-left font-sans text-[14px] font-semibold text-foreground transition-colors hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
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
                        <ResponsiveDataTable
                          columns={FEATURE_COLUMNS}
                          rows={pageFeats}
                          keyFor={(f) => f.id}
                          renderCell={renderFeatureCell}
                          loading={false}
                          actionsSlot={featureActions}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

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
