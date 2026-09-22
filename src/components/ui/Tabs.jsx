import { colors, radius, type } from "../../lib/theme.js";

export default function Tabs({ items = [], active, onChange, variant = "underline", style, className }) {
  const isPills = variant === "pills";
  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: isPills ? 8 : 2,
        flexWrap: "wrap",
        ...(isPills ? {} : { borderBottom: `1px solid ${colors.border}`, paddingBottom: 0 }),
        ...style,
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange?.(item.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: isPills ? "10px 16px" : "9px 14px",
              background: isPills ? (isActive ? colors.primary : "transparent") : "transparent",
              color: isPills ? (isActive ? "#fff" : colors.mutedForeground) : isActive ? colors.primary : colors.mutedForeground,
              border: "none",
              borderRadius: isPills ? radius.sm : 0,
              borderBottom: !isPills && isActive ? `2px solid ${colors.primary}` : "2px solid transparent",
              marginBottom: isPills ? 0 : -1,
              cursor: "pointer",
              fontFamily: type.fontFamily.sans,
              fontSize: type.fontSize.smMd,
              fontWeight: type.fontWeight.semibold,
              transition: "all .15s",
            }}
          >
            {Icon && <Icon size={14} />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}