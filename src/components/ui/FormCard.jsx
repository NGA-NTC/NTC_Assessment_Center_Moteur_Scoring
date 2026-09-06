import { LINE } from "../../lib/theme.js";

export default function FormCard({ children, onSubmit }) {
  return (
    <form
      onSubmit={onSubmit}
      style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "26px 26px 24px", boxShadow: "0 8px 30px rgba(27,42,74,0.08)" }}
    >
      {children}
    </form>
  );
}