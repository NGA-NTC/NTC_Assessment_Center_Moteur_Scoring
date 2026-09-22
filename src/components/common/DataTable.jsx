import Card from "../ui/Card.jsx";
import { LoadingState, EmptyState, ErrorState } from "../ui/States.jsx";
import { colors, type } from "../../lib/theme.js";

const cellStyle = { padding: "12px 16px", color: colors.foreground, fontSize: type.fontSize.base };

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
  return (
    <Card style={{ padding: 0, overflow: "hidden", ...style }} className={className}>
      {loading ? (
        <LoadingState minHeight={minHeight} />
      ) : error ? (
        <ErrorState title={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: type.fontSize.base }}>
            <thead>
              <tr style={{ background: colors.cream, borderBottom: `1px solid ${colors.border}` }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      padding: "12px 16px",
                      textAlign: col.align || "left",
                      fontWeight: type.fontWeight.semibold,
                      color: colors.foreground,
                      fontSize: type.fontSize.base,
                      whiteSpace: col.nowrap ? "nowrap" : undefined,
                      position: stickyHeader ? "sticky" : undefined,
                      top: stickyHeader ? 0 : undefined,
                      background: stickyHeader ? colors.cream : undefined,
                      ...col.headerStyle,
                    }}
                  >
                    {col.label ?? ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const key = keyFor ? keyFor(row, index) : index;
                return (
                  <tr
                    key={key}
                    className={isRowClickable ? "ntc-table-row" : undefined}
                    {...(isRowClickable ? { onClick: () => onRowClick(row), style: { cursor: "pointer" } } : {})}
                    style={{ borderBottom: `1px solid ${colors.border}`, ...(isRowClickable ? { cursor: "pointer" } : {}) }}
                  >
                    {columns.map((col) => (
                      <td key={col.key} style={{ ...cellStyle, textAlign: col.align || "left", ...col.cellStyle }}>
                        {renderCell ? renderCell(row, col, index) : row?.[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}