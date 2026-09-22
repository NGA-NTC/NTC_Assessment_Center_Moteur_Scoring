import { Inbox } from "lucide-react";
import Spinner from "./Spinner.jsx";
import Button from "./Button.jsx";

export function EmptyState({ icon: Icon = Inbox, title = "Aucun élément", description, action, style }) {
  return (
    <div className="px-6 py-10 text-center text-muted-foreground" style={style}>
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
        <Icon size={20} className="text-muted-foreground" />
      </div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description && <div className="mx-auto mt-1 max-w-[420px] text-[12.5px] text-muted-foreground">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Chargement…", minHeight = 300 }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2.5 text-[13px] text-muted-foreground"
      style={{ minHeight }}
    >
      <Spinner size={24} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ title = "Une erreur est survenue", description, onRetry, actionLabel = "Réessayer" }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="text-sm font-semibold text-destructive">{title}</div>
      {description && <div className="max-w-[420px] text-[12.5px] text-muted-foreground">{description}</div>}
      {onRetry && (
        <Button type="button" size="sm" variant="primary" className="mt-2 px-4" onClick={onRetry}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}