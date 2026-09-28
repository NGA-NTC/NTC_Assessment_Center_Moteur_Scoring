import { Dialog, DialogContent, DialogTitle } from "./primitives/dialog.jsx";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 480,
  hideClose = false,
  ariaLabel = title,
}) {
  if (!title) {
    // Alerte dev : DialogTitle est requis pour l'accessibilité (nom accessible du dialogue).
    console.warn("Modal: `title` est requis (DialogTitle accessible). Fournir un titre explicite.");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent
        aria-label={ariaLabel ?? title}
        showCloseButton={!hideClose}
        className="max-h-[calc(100dvh-2.5rem)] overflow-y-auto rounded-xl border-border bg-card p-6 shadow-modal sm:max-w-none"
        style={{ width: "100%", maxWidth: `min(${maxWidth}px, calc(100vw - 2.5rem))` }}
      >
        {title && <DialogTitle className="text-[18px] leading-[1.3] font-bold text-primary">{title}</DialogTitle>}
        {children}
        {footer && <div className="mt-4 flex justify-end gap-3">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}