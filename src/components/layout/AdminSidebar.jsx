import { FileJson } from "lucide-react";
import { GOLD, NAVY, SERIF } from "../../lib/theme.js";
import SearchField from "../ui/SearchField.jsx";
import FilterDropdown from "../ui/FilterDropdown.jsx";
import SidebarFooter from "./SidebarFooter.jsx";

export default function AdminSidebar({ candidates = [], selectedId = null, onSelect, onLogout, query = "", onQueryChange, filters = { type: "all", progress: "all" }, onFilters }) {
  return (
    <div style={{ width: 280, flexShrink: 0, background: NAVY, color: "#fff", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, letterSpacing: 0.2 }}>NTC Assessment</div>
        <div style={{ fontSize: 11, color: "#B8C0D4", marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" }}>Espace administrateur</div>
      </div>

      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <SearchField value={query} onChange={onQueryChange} placeholder="Rechercher un candidat…" />
      </div>

      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <FilterDropdown variant="dark" full filters={filters} onFilters={onFilters} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
        <div style={{ fontSize: 10.5, color: "#B8C0D4", textTransform: "uppercase", letterSpacing: 0.6, padding: "4px 8px 8px" }}>Candidats ({candidates.length})</div>
        {candidates.length === 0 && (
          <div style={{ padding: "16px 10px", fontSize: 12.5, color: "#9AA6C0", lineHeight: 1.6 }}>
            Aucun candidat correspondant aux critères actuels.
          </div>
        )}
        {candidates.map((c) => {
          const isActive = selectedId === c.id;
          return (
            <button key={c.id} onClick={() => onSelect(c)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 9px", marginBottom: 2,
              borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              background: isActive ? "rgba(255,255,255,0.14)" : "transparent", transition: "background .15s",
            }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: c.kind === "acct" ? GOLD : "rgba(255,255,255,0.15)", color: c.kind === "acct" ? NAVY : "#D9A94A", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
                {c.kind === "acct" ? c.label.charAt(0).toUpperCase() : <FileJson size={13} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</div>
                <div style={{ fontSize: 11, color: "#9AA6C0" }}>{c.kind === "acct" ? "Compte" : "Importé"} · {c.progress.answered}/{c.progress.total}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#B8C0D4" }}>{c.progress.pct}%</span>
            </button>
          );
        })}
      </div>

      <SidebarFooter onLogout={onLogout} />
    </div>
  );
}