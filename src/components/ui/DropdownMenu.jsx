import { useEffect, useRef, useState } from "react";
import { colors, radius, shadows, type } from "../../lib/theme.js";

export default function DropdownMenu({
  trigger,
  items = [],
  align = "right",
  width = 220,
  id,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div ref={ref} id={id} style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      {trigger({ open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) })}
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "absolute",
              top: "100%",
              ...(align === "right" ? { right: 0 } : { left: 0 }),
              marginTop: 4,
              width: `min(92vw, ${width}px)`,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              boxShadow: shadows.menu,
              zIndex: 50,
              padding: 5,
              fontFamily: type.fontFamily.sans,
            }}
          >
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                data-danger={it.danger ? "true" : "false"}
                onClick={(e) => {
                  stop(e);
                  setOpen(false);
                  it.onClick?.();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "8px 10px",
                  border: "none",
                  background: "transparent",
                  borderRadius: 7,
                  cursor: "pointer",
                  fontSize: type.fontSize.base,
                  fontFamily: type.fontFamily.sans,
                  textAlign: "left",
                  color: it.danger ? colors.destructiveStrong : colors.foreground,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = it.danger ? colors.destructiveSoft : colors.lineSoft;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {it.icon && <span style={{ display: "inline-flex", opacity: 0.85 }}>{it.icon}</span>}
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}