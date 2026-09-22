import Card from "../ui/Card.jsx";
import { NAVY, MUTED, INK, radius, type } from "../../lib/theme.js";

export default function StatCard({ label, value, icon: Icon, color = NAVY, path, onClick, hint, style }) {
  const handleClick = onClick || (path ? () => { window.location.href = path; } : undefined);
  return (
    <Card onClick={handleClick} style={{ padding: "18px 20px", borderLeft: `4px solid ${color}`, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: type.fontSize.xs, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, fontWeight: type.fontWeight.semibold }}>{label}</div>
          <div style={{ fontSize: type.fontSize.stat, fontWeight: type.fontWeight.bold, color: INK, lineHeight: 1.1 }}>{value}</div>
          {hint && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{hint}</div>}
        </div>
        {Icon && (
          <div style={{ width: 48, height: 48, borderRadius: radius.lg, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={24} color={color} />
          </div>
        )}
      </div>
    </Card>
  );
}