import { NAVY, MUTED, type } from "../../lib/theme.js";

export default function PageHeader({ title, subtitle, description, right, action, meta, style }) {
  const actions = right ?? action;
  return (
    <div
      className="page-title"
      style={{ marginBottom: 18, display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", justifyContent: "space-between", width: "100%", ...style }}
    >
      <div style={{ minWidth: 0, flex: 1, maxWidth: "100%" }}>
        <div
          className="page-title__title"
          style={{ fontFamily: type.fontFamily.serif, fontSize: type.fontSize.h1, fontWeight: type.fontWeight.bold, color: NAVY, wordBreak: "break-word" }}
        >
          {title}
        </div>
        {(subtitle || description) && (
          <div className="page-title__subtitle" style={{ fontSize: type.fontSize.base, color: MUTED, marginTop: 3, wordBreak: "break-word" }}>
            {subtitle ?? description}
          </div>
        )}
        {meta && <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>{meta}</div>}
      </div>
      {actions && <div className="page-title__actions" style={{ flexShrink: 0, minWidth: 0, maxWidth: "100%", display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}