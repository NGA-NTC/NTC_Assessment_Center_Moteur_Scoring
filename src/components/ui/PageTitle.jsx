import { NAVY, MUTED, SERIF } from "../../lib/theme.js";

export default function PageTitle({ title, subtitle, right }) {
  return (
    <div style={{ marginBottom: 18, display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: NAVY }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}