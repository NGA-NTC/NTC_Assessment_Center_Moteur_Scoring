import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../services/rbac/roles/index.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import Badge from "../components/ui/Badge.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import CheckboxField from "../components/common/CheckboxField.jsx";
import ResponsiveDataTable from "../components/common/ResponsiveDataTable.jsx";

const EMPTY_FORM = { id: "", name: "", description: "", is_assignable: false, parent_id: "" };

export default function SuperAdminRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      setRoles(await listRoles());
    } catch (e) {
      console.error("Erreur chargement rôles:", e);
      toast.error("Impossible de charger les rôles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { fetchRoles(); }, 0);
    return () => clearTimeout(t);
  }, [fetchRoles]);

  const isSystemRole = (role) => !!role?.is_system;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        const patch = isSystemRole(editingRole)
          ? { description: formData.description }
          : {
              name: formData.name,
              description: formData.description,
              is_assignable: formData.is_assignable,
              parent_id: formData.parent_id || null,
            };
        await updateRole(editingRole.id, patch);
        toast.success("Rôle mis à jour.");
      } else {
        await createRole({
          id: formData.id,
          name: formData.name,
          description: formData.description,
          is_assignable: formData.is_assignable,
          parent_id: formData.parent_id || null,
        });
        toast.success("Rôle créé.");
      }
      setShowModal(false);
      setEditingRole(null);
      setFormData(EMPTY_FORM);
      fetchRoles();
    } catch (e) {
      toast.error(e.message || "Erreur lors de la sauvegarde.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteRole(deleteTarget.id);
      toast.success("Rôle supprimé.");
      setDeleteTarget(null);
      fetchRoles();
    } catch (e) {
      toast.error(e.message || "Erreur lors de la suppression.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setFormData({
      id: role.id,
      name: role.name,
      description: role.description || "",
      is_assignable: !!role.is_assignable,
      parent_id: role.parent_id || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRole(null);
    setFormData(EMPTY_FORM);
  };

  const roleActions = (role) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditModal(role); }}>
        <Edit size={14} /> Modifier
      </Button>
      {!isSystemRole(role) && (
        <Button size="sm" variant="outlineDark" className="border-warning text-warning" onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}>
          <Trash2 size={14} /> Supprimer
        </Button>
      )}
    </div>
  );

  const columns = [
    { key: "id", label: "ID" },
    { key: "name", label: "Nom" },
    { key: "assignable", label: "Assignable" },
    { key: "parent", label: "Parent" },
    { key: "description", label: "Description" },
    { key: "actions", label: "Actions" },
  ];

  const renderCell = (role, col) => {
    switch (col.key) {
      case "id":
        return <span className="font-mono text-[12px] text-muted-foreground">{role.id}</span>;
      case "name":
        return (
          <div className="flex items-center gap-2 font-semibold text-foreground">
            {role.name}
            {isSystemRole(role) && (
              <Badge tone="system">
                <Lock size={9} className="inline-block -translate-y-px" /> SYSTEM
              </Badge>
            )}
          </div>
        );
      case "assignable":
        return <span className="text-muted-foreground">{role.is_assignable ? "Oui" : "Non"}</span>;
      case "parent":
        return <span className="font-mono text-[12px] text-muted-foreground">{role.parent_id || "—"}</span>;
      case "description":
        return <span className="block max-w-[300px] truncate text-muted-foreground">{role.description || "—"}</span>;
      case "actions":
        return roleActions(role);
      default:
        return null;
    }
  };

  const parentOptions = roles.filter((r) => !editingRole || r.id !== editingRole.id);

  return (
    <div>
      <PageTitle
        title="Rôles"
        subtitle={loading ? "Chargement…" : `${roles.length} rôle${roles.length > 1 ? "s" : ""} configuré${roles.length > 1 ? "s" : ""}`}
        action={<Button onClick={openCreateModal}><Plus size={16} /> Nouveau rôle</Button>}
      />

      <ResponsiveDataTable
        columns={columns}
        rows={roles}
        keyFor={(r) => r.id}
        renderCell={renderCell}
        loading={loading}
        emptyTitle="Aucun rôle configuré"
        emptyDescription="Créez votre premier rôle avec « Nouveau rôle »."
        actionsSlot={roleActions}
      />

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingRole ? "Modifier le rôle" : "Nouveau rôle"}
        maxWidth={480}
      >
        {isSystemRole(editingRole) && (
          <div className="mb-4 flex items-center gap-2 rounded-sm border border-warning-border bg-warning-soft px-3 py-2 text-[12.5px] text-warning-strong">
            <Lock size={13} /> Rôle système — champs verrouillés (seule la description est modifiable).
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid gap-1">
            {!editingRole && (
              <Field label="ID (unique, sans espaces)" value={formData.id} onChange={(e) => setFormData((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} required />
            )}
            <Field
              label="Nom affiché"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              required
              disabled={isSystemRole(editingRole)}
            />
            <Field label="Description" type="textarea" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} rows={3} />
            {!isSystemRole(editingRole) && (
              <>
                <CheckboxField
                  className="mb-4 pt-1 text-[14px]"
                  checked={formData.is_assignable}
                  onCheckedChange={(checked) => setFormData((f) => ({ ...f, is_assignable: checked }))}
                  label="Rôle assignable"
                  description="Apparaît dans l'interface Utilisateurs / Comptes"
                />
                <Field label="Rôle parent (optionnel)" type="select" value={formData.parent_id} onChange={(e) => setFormData((f) => ({ ...f, parent_id: e.target.value }))}>
                  <option value="">— Aucun —</option>
                  {parentOptions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                  ))}
                </Field>
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button>
            <Button type="submit"><Check size={14} /> {editingRole ? "Sauvegarder" : "Créer"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Supprimer le rôle"
        description={deleteTarget ? `Supprimer le rôle « ${deleteTarget.name} » ? Cette action est irréversible.` : ""}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}
