import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  success: { Icon: CheckCircle2, cls: "border-success-border bg-success-soft text-success" },
  error: { Icon: AlertCircle, cls: "border-destructive-border bg-destructive-soft text-destructive" },
  warning: { Icon: AlertTriangle, cls: "border-warning-border bg-warning-soft text-warning" },
  info: { Icon: Info, cls: "border-navy-soft-border bg-navy-soft text-info" },
};

export default function Alert({ type = "success", children, onDismiss, style, icon: IconOverride }) {
  const v = VARIANTS[type] || VARIANTS.info;
  const Icon = IconOverride ?? v.Icon;
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={cn("mb-4 flex items-center gap-2 rounded-sm border px-3.5 py-2.5 text-[13.5px]", v.cls)}
      style={style}
    >
      <Icon size={16} className="shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Fermer"
          onClick={onDismiss}
          className="inline-flex shrink-0 cursor-pointer p-0.5 text-inherit"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}