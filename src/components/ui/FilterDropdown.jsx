import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./primitives/popover.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./primitives/select.jsx";
import { ToggleGroup, ToggleGroupItem } from "./primitives/toggle-group.jsx";
import { cn } from "@/lib/utils";

function ChipToggleGroup({ options, value, onValueChange, ariaLabel }) {
  return (
    <ToggleGroup
      type="single"
      value={value === "all" ? "" : value}
      onValueChange={(v) => onValueChange(v === "" || v === undefined ? "all" : v)}
      aria-label={ariaLabel}
      className="grid w-full grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.key}
          value={o.key}
          className="min-w-0 cursor-pointer truncate rounded-full border border-border bg-card px-2 py-1 text-center font-sans text-[11.5px] text-foreground shadow-none data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function MinSelect({ value, onChange }) {
  return (
    <label className="flex items-center gap-2 px-2.5 pt-1.5 pb-[2px] font-sans text-xs text-muted-foreground">
      Score minimum
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-8 w-[96px] gap-1 rounded-sm px-1.5" aria-label="Score minimum">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[50, 60, 70, 80, 90].map((t) => (
            <SelectItem key={t} value={String(t)}>≥ {t} %</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
      {children}
    </div>
  );
}

function SectionDivider() {
  return <div className="mt-1.5 border-t border-border" />;
}

function ListSelect({ value, onValueChange, options, ariaLabel }) {
  return (
    <div className="px-2.5 pt-1 pb-1.5">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-full rounded-sm" aria-label={ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([k, label]) => (
            <SelectItem key={k} value={k}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const TYPE_LABELS = { all: "Tous les types", acct: "Comptes plateforme", imp: "Importés" };
const PROG_LABELS = { all: "Toutes", complete: "Complètes", incomplete: "Incomplètes" };

export default function FilterDropdown({
  filters = { type: "all", progress: "all", metier: "all", metierMin: 60, axis: "all", axisMin: 60 },
  onFilters, variant = "light", full = false, metiers = [], axes = [],
}) {
  const setFilter = (patch) => onFilters({ ...filters, ...patch });
  const opt = (k) => (k === "all" || k === undefined ? "" : k);
  const metierLabel = metiers.find((m) => m.key === filters.metier)?.name;
  const activeSummary = [
    filters.type !== "all" ? TYPE_LABELS[filters.type] : "",
    filters.progress !== "all" ? PROG_LABELS[filters.progress] : "",
    filters.metier !== "all" && metierLabel ? `Métier ${metierLabel} ≥ ${filters.metierMin}%` : "",
    filters.axis !== "all" ? `Axe ${filters.axis} ≥ ${filters.axisMin}%` : "",
  ].filter(Boolean).join(" · ");
  const dark = variant === "dark";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 font-sans text-[13px] font-semibold",
            dark ? "border-white/[0.22] bg-white/10 text-white" : "border-border bg-card text-foreground"
          )}
          style={{ width: full ? "100%" : "auto" }}
        >
          <SlidersHorizontal size={15} />
          <span>Filtres</span>
          {activeSummary && (
            <span className="truncate text-[11px] font-medium text-muted-foreground" style={{ maxWidth: "min(42vw, 170px)" }}>
              {activeSummary}
            </span>
          )}
          <ChevronDown size={14} className="ml-auto shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("max-h-[70vh] w-[min(92vw,360px)] overflow-y-auto p-2", !dark && "bg-card")}
      >
        <SectionLabel>Type de réponse</SectionLabel>
        <ListSelect value={filters.type} onValueChange={(v) => setFilter({ type: v })} options={TYPE_LABELS} ariaLabel="Type de réponse" />
        <SectionDivider />
        <SectionLabel>Progression</SectionLabel>
        <ListSelect value={filters.progress} onValueChange={(v) => setFilter({ progress: v })} options={PROG_LABELS} ariaLabel="Progression" />
        {metiers.length > 0 && (
          <>
            <SectionDivider />
            <SectionLabel>Correspondance métier</SectionLabel>
            <ChipToggleGroup
              options={metiers.map((m) => ({ key: m.key, label: m.name }))}
              value={opt(filters.metier)}
              onValueChange={(v) => setFilter({ metier: v })}
              ariaLabel="Correspondance métier"
            />
            {filters.metier !== "all" && <MinSelect value={filters.metierMin} onChange={(v) => setFilter({ metierMin: v })} />}
          </>
        )}
        {axes.length > 0 && (
          <>
            <SectionDivider />
            <SectionLabel>Axes du radar</SectionLabel>
            <ChipToggleGroup
              options={axes.map((ax) => ({ key: ax.key, label: ax.name }))}
              value={opt(filters.axis)}
              onValueChange={(v) => setFilter({ axis: v })}
              ariaLabel="Axes du radar"
            />
            {filters.axis !== "all" && <MinSelect value={filters.axisMin} onChange={(v) => setFilter({ axisMin: v })} />}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}