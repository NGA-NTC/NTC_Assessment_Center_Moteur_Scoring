import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Edit, Trash2, FileText, Save } from "lucide-react";
import {
  listPages,
  createPage,
  updatePage,
  deletePage,
} from "../services/pages/index.js";
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
import { routes } from "../routes/registry/index.jsx";

const flattenPaths = (list, acc = []) => {
  list.forEach((route) => {
    if (route.path) acc.push(route.path);
    if (route.children && route.children.length) flattenPaths(route.children, acc);
  });
  return acc;
};

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const IMPLEMENTED_PATHS = useMemo(() => flattenPaths(routes), []);
  const isPathImplemented = (path) => !path || IMPLEMENTED_PATHS.includes(path);

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

  useEffect(() => {
    const t = setTimeout(() => { fetchPages(); }, 0);
    return () => clearTimeout(t);
  }, [fetchPages]);

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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.is_system) {
      setDeleteTarget(null);
      setMessage({ type: "error", text: "Impossible de supprimer une page système." });
      return;
    }
    setDeleteBusy(true);
    try {
      await deletePage(deleteTarget.id);
      setMessage({ type: "success", text: "Page supprimée." });
      setDeleteTarget(null);
      fetchPages();
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression." });
    } finally {
      setDeleteBusy(false);
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
        <Alert type={message.type === "success" ? "success" : "error"}>
          {message.text}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <LoadingState minHeight={300} />
        ) : pages.length === 0 ? (
          <EmptyState title="Aucune page définie" description="Créez votre première page avec « Nouvelle page »." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-cream hover:bg-cream">
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Page</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Chemin</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Implémentation</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Description</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Type</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map(page => (
                <TableRow key={page.id} className="border-b border-border">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy text-white">
                        <FileText size={18} />
                      </div>
                      <span className="font-semibold text-foreground">{page.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{page.path}</TableCell>
                  <TableCell className="px-4 py-3">
                    {isPathImplemented(page.path) ? (
                      <Badge tone="success">Implémentée</Badge>
                    ) : (
                      <Badge tone="warning" title="Déclarée dans la base, aucune route correspondante dans le registre frontend">Déclarée</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate px-4 py-3 text-muted-foreground">{page.description || "—"}</TableCell>
                  <TableCell className="px-4 py-3">
                    {page.is_system ? <Badge tone="warning">Système</Badge> : <Badge tone="success">Personnalisée</Badge>}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditModal(page)}>
                        <Edit size={14} /> Modifier
                      </Button>
                      {!page.is_system && (
                        <Button size="sm" variant="outlineDark" className="border-warning text-warning" onClick={() => setDeleteTarget(page)}>
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
      </Card>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingPage ? "Modifier la page" : "Nouvelle page"}
        maxWidth={560}
      >
        <form onSubmit={handleSubmit}>
          <div className="grid gap-1">
            {!editingPage && (
              <Field label="ID (unique, sans espaces)" value={formData.id} onChange={(e) => setFormData(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} required />
            )}
            <Field label="Nom affiché" value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} required />
            <Field label="Chemin (route)" value={formData.path} onChange={(e) => setFormData(f => ({ ...f, path: e.target.value }))} placeholder="/ma-page" required />
            <Field label="Description" type="textarea" value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} />
            <Field label="Icône (nom Lucide)" value={formData.icon} onChange={(e) => setFormData(f => ({ ...f, icon: e.target.value }))} placeholder="FileText" />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button>
            <Button type="submit"><Save size={14} /> {editingPage ? "Sauvegarder" : "Créer"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Supprimer la page"
        description={deleteTarget ? `Supprimer la page « ${deleteTarget.name} » ? Cette action est irréversible.` : ""}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}