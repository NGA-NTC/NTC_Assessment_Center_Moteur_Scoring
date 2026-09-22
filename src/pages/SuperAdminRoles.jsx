import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Check, Lock } from "lucide-react";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../services/rbac/roles/index.js";
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

const EMPTY_FORM = { id: "", name: "", description: "", is_assignable: false, parent_id: "" };

export default function SuperAdminRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
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
      setMessage({ type: "error", text: "Impossible de charger les rôles." });
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
        setMessage({ type: "success", text: "Rôle mis à jour." });
      } else {
        await createRole({
          id: formData.id,
          name: formData.name,
          description: formData.description,
          is_assignable: formData.is_assignable,
          parent_id: formData.parent_id || null,
        });
        setMessage({ type: "success", text: "Rôle créé." });
      }
      setShowModal(false);
      setEditingRole(null);
      setFormData(EMPTY_FORM);
      fetchRoles();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors de la sauvegarde." });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteRole(deleteTarget.id);
      setMessage({ type: "success", text: "Rôle supprimé." });
      setDeleteTarget(null);
      fetchRoles();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erreur lors de la suppression." });
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

  const parentOptions = roles.filter((r) => !editingRole || r.id !== editingRole.id);

  return (
    <div>
      <PageTitle
        title="Rôles"
        subtitle={loading ? "Chargement…" : `${roles.length} rôle${roles.length > 1 ? "s" : ""} configuré${roles.length > 1 ? "s" : ""}`}
        action={<Button onClick={openCreateModal}><Plus size={16} /> Nouveau rôle</Button>}
      />

      {message && (
        <Alert type={message.type === "success" ? "success" : "error"}>
          {message.text}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <LoadingState minHeight={300} />
        ) : roles.length === 0 ? (
          <EmptyState title="Aucun rôle configuré" description="Créez votre premier rôle avec « Nouveau rôle »." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-cream hover:bg-cream">
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">ID</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Nom</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Assignable</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Parent</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Description</TableHead>
                <TableHead className="bg-cream px-4 py-3 text-[13px] font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id} className="border-b border-border">
                  <TableCell className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{role.id}</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      {role.name}
                      {isSystemRole(role) && (
                        <Badge tone="system">
                          <Lock size={9} className="inline-block -translate-y-px" /> SYSTEM
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{role.is_assignable ? "Oui" : "Non"}</TableCell>
                  <TableCell className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{role.parent_id || "—"}</TableCell>
                  <TableCell className="max-w-[300px] truncate px-4 py-3 text-muted-foreground">{role.description || "—"}</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditModal(role)}>
                        <Edit size={14} /> Modifier
                      </Button>
                      {!isSystemRole(role) && (
                        <Button size="sm" variant="outlineDark" className="border-warning text-warning" onClick={() => setDeleteTarget(role)}>
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
                <label className="mb-4 flex items-start gap-2.5 pt-1 text-[14px] text-foreground">
                  <input
                    type="checkbox"
                    checked={formData.is_assignable}
                    onChange={(e) => setFormData((f) => ({ ...f, is_assignable: e.target.checked }))}
                    className="mt-0.5 h-[18px] w-[18px] cursor-pointer accent-gold"
                  />
                  <span>
                    Rôle assignable
                    <span className="block text-[12px] font-normal text-muted-foreground">Apparaît dans l'interface Utilisateurs / Comptes</span>
                  </span>
                </label>
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