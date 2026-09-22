import Card from "../ui/Card.jsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/Table.jsx";
import { LoadingState, EmptyState, ErrorState } from "../ui/States.jsx";
import { cn } from "@/lib/utils";

export default function DataTable({
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
}) {
  const isRowClickable = typeof onRowClick === "function";

  const headStyle = (col) => ({
    ...(col.align ? { textAlign: col.align } : {}),
    ...(stickyHeader ? { position: "sticky", top: 0, background: "var(--ntc-cream)", zIndex: 1 } : {}),
    ...col.headerStyle,
  });

  return (
    <Card style={{ padding: 0, overflow: "hidden", ...style }} className={className}>
      {loading ? (
        <LoadingState minHeight={minHeight} />
      ) : error ? (
        <ErrorState title={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-cream">
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
                    isRowClickable
                      ? "cursor-pointer hover:bg-line-soft"
                      : undefined
                  )}
                  {...(isRowClickable ? { onClick: () => onRowClick(row) } : {})}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className="px-4 py-3"
                      style={{ ...(col.align ? { textAlign: col.align } : {}), ...col.cellStyle }}
                    >
                      {renderCell ? renderCell(row, col, index) : row?.[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}