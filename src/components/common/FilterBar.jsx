export default function FilterBar({ children, gap = 12, style, className }) {
  return (
    <div
      className={`ntc-filterbar ${className ?? ""}`.trim()}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function FilterField({ children, minWidth = 180, grow = false, style }) {
  return (
    <div style={{ minWidth, flex: grow ? 1 : undefined, width: "100%", ...style }}>
      {children}
    </div>
  );
}