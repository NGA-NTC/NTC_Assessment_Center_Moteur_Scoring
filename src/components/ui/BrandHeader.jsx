import { GOLD, MUTED, SERIF } from "../../lib/theme.js";

export default function BrandHeader({ subtitle }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 24 }}>
      <div style={{ display: "inline-flex", gap: 8, alignItems: "baseline", justifyContent: "center" }}>
        <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: "#1B2A4A" }}>NTC</span>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: GOLD }}>Assessment Center</span>
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3, letterSpacing: 0.4, textTransform: "uppercase" }}>{subtitle}</div>
    </div>
  );
}