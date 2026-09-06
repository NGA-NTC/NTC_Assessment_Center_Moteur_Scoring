import { CREAM, INK, LINE } from "../../lib/theme.js";

export default function InfoCallout({ children }) {
  return (
    <div style={{ background: CREAM, border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12.5, color: INK }}>
      {children}
    </div>
  );
}