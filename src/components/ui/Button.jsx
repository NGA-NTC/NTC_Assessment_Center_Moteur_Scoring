import { Loader2 } from "lucide-react";
import { NAVY, colors, radius, type, controls } from "../../lib/theme.js";

const variants = {
  primary: { background: colors.primary, color: "#fff" },
  gold: { background: colors.secondary, color: NAVY },
  ghost: { background: "transparent", color: NAVY, border: `1px solid ${colors.border}` },
  outline: { background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" },
  danger: { background: colors.destructive, color: "#fff" },
  outlineDark: { background: "#fff", color: NAVY, border: `1px solid ${colors.border}` },
};

const sizes = {
  sm: { padding: "9px 14px", fontSize: type.fontSize.smMd, height: controls.heightSm },
  md: { padding: "10px 18px", fontSize: type.fontSize.baseMd, height: controls.height },
  lg: { padding: "12px 18px", fontSize: type.fontSize.md, height: controls.heightLg },
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  full = false,
  loading = false,
  style,
  className,
  disabled,
  ...props
}) {
  const pad = sizes[size];
  const isBusy = loading || disabled;
  return (
    <button
      {...props}
      data-variant={variant}
      className={className ? `button ${className}` : "button"}
      disabled={isBusy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: pad.height,
        width: full ? "100%" : "auto",
        padding: pad.padding,
        borderRadius: radius.sm,
        fontSize: pad.fontSize,
        fontWeight: type.fontWeight.semibold,
        fontFamily: type.fontFamily.sans,
        border: "none",
        cursor: isBusy ? "not-allowed" : "pointer",
        opacity: isBusy && !loading ? 0.5 : 1,
        ...variants[variant],
        ...style,
      }}
    >
      {loading && <Loader2 size={size === "sm" ? 14 : 16} className="ntc-spin" />}
      {children}
    </button>
  );
}