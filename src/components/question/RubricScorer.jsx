import { B7_RUBRIC, DIM } from "../../data/index.js";
import { GOLD, LINE, MUTED, NAVY } from "../../lib/theme.js";

export default function RubricScorer({ dim, value, onChange }) {
  const d = DIM[dim];
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
      <div style={{ display: "flex", gap: 5 }}>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} onClick={() => onChange(n)} title={B7_RUBRIC[dim][n - 1]} type="button"
            style={{ flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              border: value === n ? `1.5px solid ${GOLD}` : `1px solid ${LINE}`,
              background: value === n ? GOLD : "#fff", color: value === n ? NAVY : MUTED }}>{n}</button>
        ))}
      </div>
    </div>
  );
}