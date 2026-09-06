import { NAVY, INK, LINE } from "../../lib/theme.js";

export default function Field({ label, icon, right, style, ...inputProps }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>{label}</label>
      <div style={{ position: "relative" }}>
        {icon && <span style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center" }}>{icon}</span>}
        <input
          {...inputProps}
          style={{
            width: "100%",
            padding: "11px 12px",
            paddingLeft: 38,
            ...(right ? { paddingRight: 38 } : {}),
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "inherit",
            color: INK,
            background: "#fff",
            outline: "none",
            ...style,
          }}
        />
        {right && <span style={{ position: "absolute", right: 8, top: 8, display: "flex", alignItems: "center" }}>{right}</span>}
      </div>
    </div>
  );
}