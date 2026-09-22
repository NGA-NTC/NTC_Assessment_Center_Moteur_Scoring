import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

function OptionRow({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-[7px] px-2.5 py-2 text-left font-sans text-[13px]",
        active ? "bg-navy text-white" : "bg-transparent text-ink"
      )}
    >
      {label}
      {active && <Check size={14} />}
    </button>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center rounded-full px-[9px] py-[5px] font-sans text-[11.5px] whitespace-nowrap",
        active ? "border-[1.5px] border-navy bg-navy text-white" : "border border-line bg-white text-ink"
      )}
    >
      {label}
    </button>
  );
}

function MinSelect({ value, onChange }) {
  return (
    <label className="flex items-center gap-[7px] px-2.5 pt-1.5 pb-[2px] font-sans text-xs text-muted">
      Score minimum
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cursor-pointer rounded-[6px] border border-line bg-white px-1.5 py-[3px] font-sans text-xs text-ink"
      >
        {[50, 60, 70, 80, 90].map((t) => <option key={t} value={t}>≥ {t} %</option>)}
      </select>
    </label>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted">
      {children}
    </div>
  );
}

function SectionDivider() {
  return <div className="mt-1 border-t border-line" />;
}

const TYPE_LABELS = { all: "Tous les types", acct: "Comptes plateforme", imp: "Importés" };
const PROG_LABELS = { all: "Toutes", complete: "Complètes", incomplete: "Incomplètes" };

export default function FilterDropdown({
  filters = { type: "all", progress: "all", metier: "all", metierMin: 60, axis: "all", axisMin: 60 },
  onFilters, variant = "light", full = false, metiers = [], axes = [],
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const setFilter = (patch) => onFilters({ ...filters, ...patch });
  const toggleChip = (field, value) => setFilter({ [field]: filters[field] === value ? "all" : value });
  const metierLabel = metiers.find((m) => m.key === filters.metier)?.name;
  const activeSummary = [
    filters.type !== "all" ? TYPE_LABELS[filters.type] : "",
    filters.progress !== "all" ? PROG_LABELS[filters.progress] : "",
    filters.metier !== "all" && metierLabel ? `Métier ${metierLabel} ≥ ${filters.metierMin}%` : "",
    filters.axis !== "all" ? `Axe ${filters.axis} ≥ ${filters.axisMin}%` : "",
  ].filter(Boolean).join(" · ");
  const dark = variant === "dark";

  return (
    <div className="filter-dropdown relative" ref={ref} style={{ flexGrow: full ? 1 : 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-[9px] font-sans text-[13px] font-semibold",
          dark
            ? (open ? "border-white/[0.22] bg-white/14 text-white" : "border-white/[0.22] bg-transparent text-white")
            : "border-line bg-white text-ink"
        )}
        style={{ width: full ? "100%" : "auto" }}
      >
        <SlidersHorizontal size={15} />
        <span>Filtres</span>
        {activeSummary && (
          <span
            className={cn("truncate text-[11px] font-medium", dark ? "text-navy-pale" : "text-muted")}
            style={{ maxWidth: "min(42vw, 170px)" }}
          >
            {activeSummary}
          </span>
        )}
        <ChevronDown
          size={14}
          className="ml-auto shrink-0 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div className="filter-dropdown__panel absolute top-[calc(100%+6px)] left-0 z-30 max-h-[70vh] w-[min(92vw,320px)] min-w-0 overflow-y-auto rounded-md bg-white p-2 shadow-dropdown">
          <SectionLabel>Type de réponse</SectionLabel>
          {Object.entries(TYPE_LABELS).map(([k, label]) => (
            <OptionRow key={k} label={label} active={filters.type === k} onClick={() => setFilter({ type: k })} />
          ))}
          <SectionDivider />
          <SectionLabel>Progression</SectionLabel>
          {Object.entries(PROG_LABELS).map(([k, label]) => (
            <OptionRow key={k} label={label} active={filters.progress === k} onClick={() => setFilter({ progress: k })} />
          ))}
          {metiers.length > 0 && (
            <>
              <SectionDivider />
              <SectionLabel>Correspondance métier</SectionLabel>
              <div className="flex flex-wrap gap-1.5 px-2.5 py-1.5">
                {metiers.map((m) => (
                  <Chip key={m.key} label={m.name} active={filters.metier === m.key} onClick={() => toggleChip("metier", m.key)} />
                ))}
              </div>
              {filters.metier !== "all" && <MinSelect value={filters.metierMin} onChange={(v) => setFilter({ metierMin: v })} />}
            </>
          )}
          {axes.length > 0 && (
            <>
              <SectionDivider />
              <SectionLabel>Axes du radar</SectionLabel>
              <div className="flex flex-wrap gap-1.5 px-2.5 py-1.5">
                {axes.map((ax) => (
                  <Chip key={ax.key} label={ax.name} active={filters.axis === ax.key} onClick={() => toggleChip("axis", ax.key)} />
                ))}
              </div>
              {filters.axis !== "all" && <MinSelect value={filters.axisMin} onChange={(v) => setFilter({ axisMin: v })} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}