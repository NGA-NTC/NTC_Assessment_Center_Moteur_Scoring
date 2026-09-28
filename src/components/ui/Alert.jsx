import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { Alert as PrimitiveAlert, AlertDescription, AlertTitle } from "./primitives/alert.jsx";
import { Button } from "./primitives/button.jsx";

const TYPE_MAP = {
  success: { variant: "success", Icon: CheckCircle2 },
  error: { variant: "destructive", Icon: AlertCircle },
  warning: { variant: "warning", Icon: AlertTriangle },
  info: { variant: "info", Icon: Info },
};

export default function Alert({ type = "success", title, children, onDismiss, style, icon: IconOverride }) {
  const t = TYPE_MAP[type] || TYPE_MAP.info;
  const Icon = IconOverride ?? t.Icon;
  return (
    <div className="relative mb-4">
      <PrimitiveAlert variant={t.variant} className={onDismiss ? "pr-10" : undefined} style={style}>
        <Icon size={16} />
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription>{children}</AlertDescription>
      </PrimitiveAlert>
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fermer"
          onClick={onDismiss}
          className="absolute top-1.5 right-1.5 size-7 text-current opacity-70 hover:opacity-100"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}