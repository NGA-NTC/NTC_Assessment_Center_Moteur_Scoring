import { cn } from "@/lib/utils";

export default function Tabs({ items = [], active, onChange, variant = "underline", style, className }) {
  const pills = variant === "pills";
  return (
    <div
      className={cn(
        "flex flex-wrap",
        pills ? "gap-2" : "gap-0.5 border-b border-border",
        className
      )}
      style={style}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange?.(item.id)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 font-sans text-[13px] font-semibold transition-all",
              pills ? "px-4 py-2.5" : "px-3.5 py-2.5",
              isActive
                ? pills
                  ? "rounded-sm bg-primary text-white"
                  : "border-b-2 border-primary text-primary"
                : pills
                  ? "rounded-sm bg-transparent text-muted-foreground hover:text-navy"
                  : "-mb-px border-b-2 border-transparent text-muted-foreground hover:text-navy"
            )}
          >
            {Icon && <Icon size={14} />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}