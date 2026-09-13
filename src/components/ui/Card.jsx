import { LINE } from "../../lib/theme.js";

export default function Card({ children, onClick, style, ...props }) {
  const baseStyle = {
    background: "#fff",
    border: `1px solid ${LINE}`,
    borderRadius: 14,
    boxShadow: "0 8px 30px rgba(27,42,74,0.08)",
    ...style,
  };

  if (onClick) {
    return (
      <div {...props} onClick={onClick} style={{ ...baseStyle, cursor: "pointer", transition: "transform .15s, box-shadow .15s" }}>
        {children}
      </div>
    );
  }

  return <div {...props} style={baseStyle}>{children}</div>;
}