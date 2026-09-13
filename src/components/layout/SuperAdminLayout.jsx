import { CREAM, INK, SANS, LINE } from "../../lib/theme.js";
import SuperAdminSidebar from "./SuperAdminSidebar.jsx";

export default function SuperAdminLayout({ children }) {
  return (
    <div className="super-admin-shell" style={{ display: "flex", minHeight: "100svh", width: "100%", background: CREAM, fontFamily: SANS, color: INK, overflowX: "clip" }}>
      <div className="super-admin-shell__sidebar">
        <SuperAdminSidebar />
      </div>
      <div className="super-admin-shell__main" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ 
          background: "#fff", 
          borderBottom: `1px solid ${LINE}`, 
          padding: "16px 24px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: INK }}>Super Admin</h1>
        </header>
        <div className="super-admin-shell__content" style={{ flex: 1, padding: "28px 26px", maxWidth: "100%", width: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  );
}