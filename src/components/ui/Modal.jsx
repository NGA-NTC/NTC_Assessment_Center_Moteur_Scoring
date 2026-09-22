import { useEffect } from "react";
import { X } from "lucide-react";
import { NAVY, colors, radius, shadows, type, controls } from "../../lib/theme.js";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ntc-modal-overlay" style={{ zIndex: 100 }} onClick={onClose} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="ntc-modal-panel" style={{ maxWidth, boxShadow: shadows.modal, borderRadius: radius.xl }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: type.fontSize.h3, fontWeight: type.fontWeight.bold, color: NAVY, lineHeight: 1.3 }}>{title}</h3>
          {!hideClose && (
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              style={{ background: "transparent", border: "none", borderRadius: radius.sm, width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: colors.mutedForeground, flexShrink: 0 }}
            >
              <X size={20} />
            </button>
          )}
        </div>
        {children}
        {footer && <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: controls.spaceY }}>{footer}</div>}
      </div>
    </div>
  );
}