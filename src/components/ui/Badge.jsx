import { MUTED, NAVY } from "../../lib/theme.js";

const tones = {
  compte: { background: "#E7EDF7", color: NAVY },
  import: { background: "#F5EBD6", color: "#7A5A15" },
  success: { background: "#E3F0E4", color: "#2E6B3C" },
  neutral: { background: "#F0EEE6", color: MUTED },
};

export default function Badge({ children, tone = "neutral" }) {
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: t.background, color: t.color, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}