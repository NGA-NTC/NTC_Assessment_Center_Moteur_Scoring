import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { INK, LINE, MUTED } from "../../lib/theme.js";

function OptionRow({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      padding: "8px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit",
      background: active ? "#1B2A4A" : "transparent", color: active ? "#fff" : INK, fontSize: 13, textAlign: "left",
    }}>
      {label}
      {active && <Check size={14} />}
    </button>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "5px 9px", borderRadius: 999, border: active ? "1.5px solid #1B2A4A" : `1px solid ${LINE}`,
      background: active ? "#1B2A4A" : "#fff", color: active ? "#fff" : INK, fontSize: 11.5, cursor: "pointer",
      fontFamily: "inherit", whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );
}

function MinSelect({ value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: MUTED, padding: "6px 10px 2px" }}>
      Score minimum
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={{
        fontFamily: "inherit", fontSize: 12, padding: "3px 6px", borderRadius: 6, border: `1px solid ${LINE}`,
        background: "#fff", color: INK, cursor: "pointer",
      }}>
        {[50, 60, 70, 80, 90].map((t) => <option key={t} value={t}>≥ {t} %</option>)}
      </select>
    </label>
  );
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
    <div ref={ref} style={{ position: "relative", flexGrow: full ? 1 : 0 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 8, width: full ? "100%" : "auto",
        padding: "9px 12px", borderRadius: 8, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
        fontSize: 13, fontWeight: 600,
        background: dark ? (open ? "rgba(255,255,255,0.12)" : "transparent") : "#fff",
        border: dark ? "1px solid rgba(255,255,255,0.22)" : `1px solid ${LINE}`,
        color: dark ? "#fff" : INK,
      }}>
        <SlidersHorizontal size={15} /> Filtres
        {activeSummary && <span style={{ fontSize: 11, fontWeight: 500, color: dark ? "#B8C0D4" : MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{activeSummary}</span>}
        <ChevronDown size={14} style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 30, minWidth: 260,
          background: "#fff", color: INK, borderRadius: 10, padding: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
          maxHeight: "70vh", overflowY: "auto",
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: MUTED, padding: "6px 10px 4px" }}>Type de réponse</div>
          {Object.entries(TYPE_LABELS).map(([k, label]) => (
            <OptionRow key={k} label={label} active={filters.type === k} onClick={() => setFilter({ type: k })} />
          ))}
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: MUTED, padding: "10px 10px 4px", marginTop: 4, borderTop: `1px solid ${LINE}` }}>Progression</div>
          {Object.entries(PROG_LABELS).map(([k, label]) => (
            <OptionRow key={k} label={label} active={filters.progress === k} onClick={() => setFilter({ progress: k })} />
          ))}
          {metiers.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: MUTED, padding: "10px 10px 4px", marginTop: 4, borderTop: `1px solid ${LINE}` }}>Correspondance métier</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 10px" }}>
                {metiers.map((m) => (
                  <Chip key={m.key} label={m.name} active={filters.metier === m.key} onClick={() => toggleChip("metier", m.key)} />
                ))}
              </div>
              {filters.metier !== "all" && <MinSelect value={filters.metierMin} onChange={(v) => setFilter({ metierMin: v })} />}
            </>
          )}
          {axes.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: MUTED, padding: "10px 10px 4px", marginTop: 4, borderTop: `1px solid ${LINE}` }}>Axes du radar</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 10px" }}>
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