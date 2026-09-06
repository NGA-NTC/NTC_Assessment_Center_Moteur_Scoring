import { CheckCircle2 } from "lucide-react";
import { BATTERIES } from "../../data/index.js";
import { progress } from "../../lib/scoring.js";
import { GOLD2, NAVY, SERIF } from "../../lib/theme.js";
import ProgressCircle from "../ui/ProgressCircle.jsx";
import SidebarFooter from "./SidebarFooter.jsx";

export default function Sidebar({ active, setActive, responses, userEmail, onLogout }) {
  return (
    <div style={{ width: 260, flexShrink: 0, background: NAVY, color: "#fff", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "22px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, letterSpacing: 0.2 }}>NTC Assessment</div>
        <div style={{ fontSize: 11, color: "#B8C0D4", marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" }}>Évaluation</div>
        <div style={{ fontSize: 12, color: GOLD2, marginTop: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
        {BATTERIES.map((b) => {
          const p = progress(b, responses);
          const isActive = active === b.id;
          return (
            <button key={b.id} onClick={() => setActive(b.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", marginBottom: 3, borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: isActive ? "rgba(255,255,255,0.12)" : "transparent", transition: "background .15s" }}>
              <ProgressCircle done={p.answered} total={p.total}>
                {p.answered === p.total && p.total > 0 && <CheckCircle2 size={14} color={GOLD2} />}
              </ProgressCircle>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: "#fff" }}>B{b.id} · {b.name}</div>
                <div style={{ fontSize: 11, color: "#9AA6C0" }}>{p.answered}/{p.total}</div>
              </div>
            </button>
          );
        })}
      </div>
      <SidebarFooter onLogout={onLogout} />
    </div>
  );
}