import { Search } from "lucide-react";
import { LINE, MUTED } from "../../lib/theme.js";

export default function SearchField({ value, onChange, placeholder = "Rechercher…" }) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <Search size={15} style={{ position: "absolute", left: 11, top: 10, color: MUTED, pointerEvents: "none" }} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "9px 12px 9px 34px",
          borderRadius: 8,
          border: `1px solid ${LINE}`,
          background: "#fff",
          fontSize: 13.5,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </div>
  );
}