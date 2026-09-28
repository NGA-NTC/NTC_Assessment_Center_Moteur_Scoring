import Card from "../ui/Card.jsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/Table.jsx";
import { EmptyState, ErrorState, TableSkeleton, CardListSkeleton } from "../ui/States.jsx";
import useMediaQuery from "../../hooks/ui/useMediaQuery.js";
import { cn } from "@/lib/utils";

export default function ResponsiveDataTable({
  columns = [],
  rows = [],
  keyFor,
  renderCell,
  onRowClick,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "Aucun élément",
  emptyDescription,
  emptyAction,
  minHeight = 300,
  stickyHeader = false,
  emptyIcon,
  className,
  style,
  cardTitleKey,
  cardOptions,
  actionsLabel = "Actions",
  actionsSlot,
  breakpoint = 768,
}) {
  const isDesktop = useMediaQuery(`(min-width: ${breakpoint}px)`);
  const isRowClickable = typeof onRowClick === "function";
  const actionsKey = cardOptions?.actionsKey ?? "actions";

  const headStyle = (col) => ({
    ...(col.align ? { textAlign: col.align } : {}),
    ...(stickyHeader ? { position: "sticky", top: 0, background: "var(--card)", zIndex: 1 } : {}),
    ...col.headerStyle,
  });

  const cellRender = (row, col) => (renderCell ? renderCell(row, col) : row?.[col.key]);

  const renderEmpty = (minH) => (
    <Card style={{ padding: 0, overflow: "hidden", minHeight: minH, ...style }} className={className}>
      <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
    </Card>
  );

  const renderError = () => (
    <Card style={{ padding: 0, overflow: "hidden", ...style }} className={className}>
      <ErrorState title={error} onRetry={onRetry} />
    </Card>
  );

  if (loading) {
    return isDesktop
      ? <TableSkeleton columnCount={columns.length} minHeight={minHeight} />
      : <CardListSkeleton />;
  }

  if (error) return renderError();
  if (rows.length === 0) return renderEmpty(minHeight);

  if (!isDesktop) {
    // Vue mobile en Card/List : chaque ligne devient une carte empilée
    // (libellé/valeur), jamais de scroll horizontal.
    return (
      <div className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const key = keyFor ? keyFor(row, index) : index;
          const titleCols = cardTitleKey ? (Array.isArray(cardTitleKey) ? cardTitleKey : [cardTitleKey]) : null;
          const metaCols = columns.filter((col) => col.key !== actionsKey && (!titleCols || !titleCols.includes(col.key)));
          const rowActions = actionsSlot ? actionsSlot(row) : null;
          const titleActions = !actionsSlot ? columns.find((col) => col.key === actionsKey) : null;
          return (
            <div
              key={key}
              onClick={isRowClickable ? () => onRowClick(row) : undefined}
              role={isRowClickable ? "button" : undefined}
              tabIndex={isRowClickable ? 0 : undefined}
              onKeyDown={isRowClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(row); } } : undefined}
              className={cn(
                "block w-full rounded-xl border border-border bg-surface p-4 text-left",
                isRowClickable && "cursor-pointer transition-colors duration-150 hover:border-gold2"
              )}
            >
              {titleCols && (
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {titleCols.map((ck) => {
                      const col = columns.find((c) => c.key === ck);
                      return (
                        <div key={ck} className="truncate text-[14px] font-semibold text-foreground">
                          {col ? cellRender(row, col) : null}
                        </div>
                      );
                    })}
                  </div>
                  {titleActions && <div className="shrink-0">{cellRender(row, titleActions)}</div>}
                </div>
              )}
              {metaCols.map((col) => {
                const value = cellRender(row, col);
                if (value == null || value === false || value === "") return null;
                return (
                  <div
                    key={col.key}
                    className="flex items-baseline justify-between gap-3 border-t border-border py-1.5 first:border-t-0 first:pt-0"
                  >
                    <span className="shrink-0 pl-1 text-[11px] font-semibold text-muted-foreground">
                      {col.label ?? ""}
                    </span>
                    <span className="min-w-0 pr-1 text-right text-[12.5px] text-foreground [&_.truncate]:max-w-[60%]">
                      {value}
                    </span>
                  </div>
                );
              })}
              {rowActions && (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2.5">
                  <span className="sr-only">{actionsLabel}</span>
                  {rowActions}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: "hidden", ...style }} className={className}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-surface">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="px-4 py-3 font-semibold text-foreground"
                style={headStyle(col)}
              >
                {col.label ?? ""}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const key = keyFor ? keyFor(row, index) : index;
            return (
              <TableRow
                key={key}
                className={cn(
                  "border-b border-border transition-colors",
                  isRowClickable ? "cursor-pointer hover:bg-line-soft" : undefined
                )}
                {...(isRowClickable ? { onClick: () => onRowClick(row) } : {})}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className="px-4 py-3"
                    style={{ ...(col.align ? { textAlign: col.align } : {}), ...col.cellStyle }}
                  >
                    {cellRender(row, col)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}