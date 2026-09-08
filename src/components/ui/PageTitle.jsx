import { NAVY, MUTED, SERIF } from "../../lib/theme.js";

export default function PageTitle({ title, subtitle, right }) {
  return (
    <div className="page-title" style={{ marginBottom: 18, display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", justifyContent: "space-between", width: "100%" }}>
      <div style={{ minWidth: 0, flex: 1, maxWidth: "100%" }}>
        <div className="page-title__title" style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: NAVY, wordBreak: "break-word" }}>{title}</div>
        {subtitle && <div className="page-title__subtitle" style={{ fontSize: 13, color: MUTED, marginTop: 3, wordBreak: "break-word" }}>{subtitle}</div>}
      </div>
      {right && <div className="page-title__actions" style={{ flexShrink: 0, minWidth: 0, maxWidth: "100%" }}>{right}</div>}
    </div>
  );
}