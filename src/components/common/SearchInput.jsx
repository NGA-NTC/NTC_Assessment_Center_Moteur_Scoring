import { Search } from "lucide-react";
import { colors, radius, type, controls } from "../../lib/theme.js";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  size = "md",
  style,
  className,
  disabled,
  autoFocus,
}) {
  const isSmall = size === "sm";
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, ...style }}>
      <Search size={isSmall ? 14 : 15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: colors.mutedForeground, pointerEvents: "none" }} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className={className}
        style={{
          width: "100%",
          minHeight: isSmall ? controls.heightSm : controls.height,
          paddingLeft: 34,
          paddingRight: 12,
          borderRadius: radius.sm,
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          fontSize: type.fontSize.baseMd,
          fontFamily: type.fontFamily.sans,
          outline: "none",
          color: colors.foreground,
        }}
      />
    </div>
  );
}