export default function BrandHeader({ subtitle }) {
  return (
    <div className="mb-6 text-center">
      <div className="inline-flex items-baseline justify-center gap-2">
        <span className="text-[26px] font-bold text-primary font-serif">NTC</span>
        <span className="text-xs font-semibold uppercase tracking-[1.2px] text-secondary">Assessment Center</span>
      </div>
      {subtitle && (
        <div className="mt-[3px] text-[11.5px] uppercase tracking-[0.4px] text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}