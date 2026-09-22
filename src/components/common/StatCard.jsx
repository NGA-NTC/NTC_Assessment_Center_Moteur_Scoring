import Card from "../ui/Card.jsx";

export default function StatCard({ label, value, icon: Icon, color = "#1B2A4A", path, onClick, hint, style }) {
  const handleClick = onClick || (path ? () => { window.location.href = path; } : undefined);
  return (
    <Card
      onClick={handleClick}
      className="p-4.5"
      style={{ borderLeft: `4px solid ${color}`, ...style }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 text-[11px] font-semibold tracking-[0.5px] text-muted-foreground uppercase">
            {label}
          </div>
          <div className="text-[28px] leading-[1.1] font-bold text-foreground">{value}</div>
          {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${color}15` }}
          >
            <Icon size={24} color={color} />
          </div>
        )}
      </div>
    </Card>
  );
}