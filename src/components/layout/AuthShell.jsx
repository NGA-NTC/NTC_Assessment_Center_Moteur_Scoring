import { CREAM, SANS } from "../../lib/theme.js";

export default function AuthShell({ children, maxWidth = 400 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS }}>
      <div style={{ width: "100%", maxWidth, margin: 16 }}>{children}</div>
    </div>
  );
}