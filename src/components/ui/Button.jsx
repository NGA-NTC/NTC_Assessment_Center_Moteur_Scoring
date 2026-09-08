import { NAVY, GOLD } from "../../lib/theme.js";

const variants = {
  primary: { background: NAVY, color: "#fff" },
  gold: { background: GOLD, color: NAVY },
  ghost: { background: "transparent", color: NAVY, border: "1px solid #E4DFD0" },
  outline: { background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" },
};

export default function Button({ children, variant = "primary", size = "md", full = false, style, className, ...props }) {
  const pad = size === "sm" ? "9px 14px" : size === "lg" ? "12px 18px" : "10px 18px";
  const font = size === "sm" ? 12.5 : 13.5;
  return (
    <button
      {...props}
      className={className ? `button ${className}` : "button"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : "auto",
        padding: pad,
        borderRadius: 8,
        fontSize: font,
        fontWeight: 600,
        fontFamily: "inherit",
        border: "none",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}