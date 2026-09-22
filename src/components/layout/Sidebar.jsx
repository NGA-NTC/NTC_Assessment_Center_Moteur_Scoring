import { NAVY, GOLD, SERIF } from "../../lib/theme.js";
import { findNavMatch } from "../../routes/navigation/index.js";
import UserAvatar from "./UserAvatar.jsx";

export default function Sidebar({
  items = [],
  activePath = "",
  onNavigate,
  sectionLabels = {},
  subtitle = "",
}) {
  const activeItem = findNavMatch(items, activePath);
  const sections = [...new Set(items.map((item) => item.section))];

  return (
    <div
      className="app-sidebar"
      style={{ width: "100%", maxWidth: 280, flexShrink: 0, background: NAVY, color: "#fff", display: "flex", flexDirection: "column", height: "100%" }}
    >
      <button
        type="button"
        onClick={() => onNavigate?.(items[0]?.path ?? "/")}
        className="app-sidebar__brand"
        style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "inherit", fontFamily: "inherit", padding: "20px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, letterSpacing: 0.2 }}>NTC Assessment</div>
        <div style={{ fontSize: 11, color: GOLD, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" }}>{subtitle}</div>
      </button>

      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 8px 0" }}>
        {sections.map((section) => (
          <div key={section} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10.5, color: GOLD, textTransform: "uppercase", letterSpacing: 0.6, padding: "8px 12px 4px" }}>
              {sectionLabels[section] ?? section}
            </div>

            {items
              .filter((item) => item.section === section)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeItem === item;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate?.(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", marginBottom: 2,
                      borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: isActive ? "rgba(255,255,255,0.14)" : "transparent",
                      transition: "background .15s", fontFamily: "inherit", fontSize: 13, color: "#fff",
                    }}
                  >
                    {Icon ? <Icon size={18} style={{ flexShrink: 0 }} /> : null}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>
                    {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD }} />}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <UserAvatar variant="sidebar" onNavigate={onNavigate} />
      </div>
    </div>
  );
}