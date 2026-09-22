import { Inbox } from "lucide-react";
import Spinner from "./Spinner.jsx";
import { colors, radius } from "../../lib/theme.js";

export function EmptyState({ icon: Icon = Inbox, title = "Aucun élément", description, action, style }) {
  return (
    <div style={{ padding: "40px 24px", textAlign: "center", color: colors.mutedForeground, ...style }}>
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: radius.lg, background: colors.neutralSoft, marginBottom: 12 }}>
        <Icon size={20} color={colors.mutedForeground} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground }}>{title}</div>
      {description && <div style={{ fontSize: 12.5, color: colors.mutedForeground, marginTop: 4, maxWidth: 420, marginInline: "auto" }}>{description}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Chargement…", minHeight = 300 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight, color: colors.mutedForeground, fontSize: 13 }}>
      <Spinner size={24} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ title = "Une erreur est survenue", description, onRetry, actionLabel = "Réessayer" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 240, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: colors.destructive }}>{title}</div>
      {description && <div style={{ fontSize: 12.5, color: colors.mutedForeground, maxWidth: 420 }}>{description}</div>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{ marginTop: 8, padding: "9px 16px", borderRadius: radius.sm, border: "none", background: colors.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}