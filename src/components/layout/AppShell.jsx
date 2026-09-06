import { CREAM, INK, SANS } from "../../lib/theme.js";

export default function AppShell({ sidebar, children, maxWidth = 900 }) {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: CREAM, fontFamily: SANS, color: INK }}>
      {sidebar}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <div style={{ maxWidth, margin: "0 auto", padding: "28px 26px" }}>{children}</div>
      </div>
    </div>
  );
}