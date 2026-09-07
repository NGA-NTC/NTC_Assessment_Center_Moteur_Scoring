import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { INK, LINE, MUTED } from "../../lib/theme.js";

function prevent(e) {
  e.stopPropagation();
  e.preventDefault();
}

export default function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Options"
        onClick={(e) => { prevent(e); setOpen((o) => !o); }}
        onMouseDown={prevent}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent",
          color: MUTED, cursor: "pointer", flexShrink: 0,
        }}>
        <MoreVertical size={17} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, minWidth: 200, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, boxShadow: "0 6px 24px rgba(27,42,74,.12)", zIndex: 50, padding: 5, fontFamily: "inherit" }}>
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { prevent(e); setOpen(false); it.onClick(); }}
              style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px",
                border: "none", background: "transparent", borderRadius: 7, cursor: "pointer",
                fontSize: 13, fontFamily: "inherit", textAlign: "left", color: it.danger ? "#B3261E" : INK,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = it.danger ? "#FDEBEA" : "#F4F1E8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {it.icon && <span style={{ display: "inline-flex", opacity: 0.85 }}>{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}