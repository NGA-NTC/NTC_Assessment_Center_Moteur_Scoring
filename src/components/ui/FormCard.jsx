import { colors, radius, shadows } from "../../lib/theme.js";

export default function FormCard({ children, onSubmit, style, ...props }) {
  return (
    <form
      onSubmit={onSubmit}
      {...props}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: "26px 26px 24px",
        boxShadow: shadows.card,
        ...style,
      }}
    >
      {children}
    </form>
  );
}