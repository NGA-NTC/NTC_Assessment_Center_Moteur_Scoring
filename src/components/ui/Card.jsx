import { colors, radius, shadows } from "../../lib/theme.js";

export default function Card({ children, onClick, style, variant = "default", ...props }) {
  const baseStyle = {
    background: variant === "flat" ? colors.background : colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    boxShadow: variant === "flat" ? "none" : shadows.card,
    ...style,
  };

  if (onClick) {
    return (
      <div
        {...props}
        onClick={onClick}
        className="ntc-card-interactive"
        style={baseStyle}
      >
        {children}
      </div>
    );
  }

  return <div {...props} style={baseStyle}>{children}</div>;
}