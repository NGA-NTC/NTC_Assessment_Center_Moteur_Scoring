import { cn } from "@/lib/utils";

export default function Card({ children, onClick, style, variant = "default", className, ...props }) {
  const base = cn(
    "rounded-xl border border-border",
    variant === "flat" ? "bg-background shadow-none" : "bg-surface shadow-card",
    onClick && "ntc-card-interactive",
    className
  );

  if (onClick) {
    return (
      <div {...props} onClick={onClick} className={base} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div {...props} className={base} style={style}>
      {children}
    </div>
  );
}