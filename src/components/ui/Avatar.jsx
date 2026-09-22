import { colors, radius, type } from "../../lib/theme.js";

function resolveInitials(name, email) {
  const n = (name || "").trim().split(/\s+/).filter(Boolean);
  if (n.length >= 2) return (n[0][0] + n[n.length - 1][0]).toUpperCase();
  if (n.length === 1) return n[0][0].toUpperCase();
  return email?.[0]?.toUpperCase() || "U";
}

export default function Avatar({
  name = "",
  email = "",
  initials: initialsProp,
  size = 36,
  gradient = false,
  style,
  ...props
}) {
  const initials = initialsProp ?? resolveInitials(name, email);
  const background = gradient ? `linear-gradient(135deg, ${colors.navy}, ${colors.gold})` : colors.navy;
  return (
    <div
      {...props}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: radius.circle,
        flexShrink: 0,
        background,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: type.fontWeight.bold,
        fontSize: size >= 40 ? type.fontSize.md : type.fontSize.base,
        userSelect: "none",
        ...style,
      }}
    >
      {initials}
    </div>
  );
}