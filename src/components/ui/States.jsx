import { Inbox } from "lucide-react";
import Button from "./Button.jsx";
import { Skeleton } from "./primitives/skeleton.jsx";

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
    <div className="flex flex-col justify-center gap-3" style={{ minHeight }} aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <div className="grid gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
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

export function TableSkeleton({ columnCount = 6, rowCount = 6, minHeight = 300, style }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card"
      style={{ minHeight, ...style }}
    >
      <div className="flex h-12 items-center gap-4 border-b border-border bg-surface px-4">
        {Array.from({ length: columnCount }).map((_, i) => (
          <Skeleton key={i} className="h-3.5" style={{ width: `${100 / columnCount}%` }} />
        ))}
      </div>
      {Array.from({ length: rowCount }).map((_, row) => (
        <div key={row} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0">
          {Array.from({ length: columnCount }).map((_, col) => (
            <Skeleton key={col} className="h-3" style={{ width: `${100 / columnCount}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 4 }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowListSkeleton({ count = 6 }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-3.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StatGridSkeleton({ count = 6 }) {
  return (
    <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}