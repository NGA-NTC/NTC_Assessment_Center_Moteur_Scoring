import { CREAM, INK, SANS } from "../../lib/theme.js";

export default function AppShell({ sidebar, children, maxWidth = 900 }) {
  return (
    <div className="app-shell" style={{ display: "flex", minHeight: "100svh", width: "100%", background: CREAM, fontFamily: SANS, color: INK, overflowX: "hidden" }}>
      <div className="app-shell__sidebar">{sidebar}</div>
      <div className="app-shell__main" style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <div className="app-shell__content" style={{ maxWidth, margin: "0 auto", padding: "28px 26px" }}>{children}</div>
      </div>
    </div>
  );
}