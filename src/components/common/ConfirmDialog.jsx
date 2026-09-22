import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = "Confirmer",
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  loading = false,
  danger = false,
  maxWidth = 440,
}) {
  return (
    <Modal open={open} onClose={loading ? undefined : onCancel} title={title} maxWidth={maxWidth}>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#5c594d" }}>{description}</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}