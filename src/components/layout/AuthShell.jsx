import { CREAM, SANS } from "../../lib/theme.js";

export default function AuthShell({ children, maxWidth = 400 }) {
  return (
    <div style={{ minHeight: "100svh", width: "100%", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: "28px 16px" }}>
      <div style={{ width: "100%", maxWidth, margin: "auto 0" }}>{children}</div>
    </div>
  );
}