import { DIM } from "../../data/index.js";
import { LINE, MUTED, NAVY } from "../../lib/theme.js";

const OPTS = [["none", "Non obs."], ["leger", "Léger"], ["modere", "Modéré"], ["fort", "Fort"]];

export default function IntensityToggle({ dimKey, value, onChange }) {
  return (
    <div className="intensity-toggle" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div className="intensity-toggle__label" style={{ fontSize: 12, width: 150, flexShrink: 0 }}>{DIM[dimKey]?.name}</div>
      <div className="intensity-toggle__options" style={{ display: "flex", gap: 4, flex: 1 }}>
        {OPTS.map(([k, label]) => (
          <button key={k} onClick={() => onChange(k)} type="button" style={{
            flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            border: value === k ? `1.5px solid ${NAVY}` : `1px solid ${LINE}`,
            background: value === k ? NAVY : "#fff", color: value === k ? "#fff" : MUTED, fontWeight: value === k ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>
    </div>
  );
}