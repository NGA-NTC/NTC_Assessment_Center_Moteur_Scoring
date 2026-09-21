import { NAVY, INK, LINE } from "../../lib/theme.js";

export default function Field({ label, icon, right, style, type = "text", multiline, rows = 3, children, ...inputProps }) {
  const isSelect = type === "select";
  const isTextarea = type === "textarea" || multiline;
  const baseStyle = {
    width: "100%",
    padding: "11px 12px",
    paddingLeft: icon ? 38 : undefined,
    ...(right ? { paddingRight: 34 } : {}),
    border: `1px solid ${LINE}`,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    color: INK,
    background: "#fff",
    outline: "none",
    ...style,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>
        {!isSelect && label}
      </label>
      <div style={{ position: "relative" }}>
        {icon && <span style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center" }}>{icon}</span>}
        {isSelect ? (
          <div>
            {label && <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>{label}</span>}
            <select
              {...inputProps}
              style={{
                ...baseStyle,
                appearance: "none",
                WebkitAppearance: "none",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%238A8578' d='M6 8 0 0h12z'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
                paddingRight: 34,
              }}
            >
              {children}
            </select>
          </div>
        ) : isTextarea ? (
          <textarea {...inputProps} rows={rows} style={{ ...baseStyle, resize: "vertical", minHeight: 44 }} />
        ) : (
          <input type={type} {...inputProps} style={baseStyle} />
        )}
        {right && <span style={{ position: "absolute", right: 8, top: 12, display: "flex", alignItems: "center" }}>{right}</span>}
      </div>
    </div>
  );
}