import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { colors, radius } from "../../lib/theme.js";

const variants = {
  success: { Icon: CheckCircle2, background: colors.successSoft, color: colors.success, border: colors.successBorder },
  error: { Icon: AlertCircle, background: colors.destructiveSoft, color: colors.destructive, border: colors.destructiveBorder },
  warning: { Icon: AlertTriangle, background: colors.warningSoft, color: colors.warning, border: colors.warningBorder },
  info: { Icon: Info, background: colors.navySoft, color: colors.info, border: colors.navySoftBorder },
};

export default function Alert({ type = "success", children, onDismiss, style, icon: IconOverride }) {
  const v = variants[type] || variants.info;
  const Icon = IconOverride ?? v.Icon;
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: radius.sm,
        fontSize: type === "error" ? 13 : 13.5,
        background: v.background,
        border: `1px solid ${v.border}`,
        color: v.color,
        display: "flex",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Fermer"
          onClick={onDismiss}
          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", flexShrink: 0, padding: 2, display: "inline-flex" }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}