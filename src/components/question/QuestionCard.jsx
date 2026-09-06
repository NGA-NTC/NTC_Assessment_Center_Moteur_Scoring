import { GOLD, LINE, MUTED, SERIF } from "../../lib/theme.js";

export default function QuestionCard({ id, dimName, text, children, marginBottom = 12 }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 18px", marginBottom }}>
      {(id || dimName) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {id && <span style={{ fontFamily: SERIF, color: GOLD, fontWeight: 600, fontSize: 13.5 }}>{id}</span>}
          {dimName && <span style={{ fontSize: 11, color: MUTED, alignSelf: "center" }}>· {dimName}</span>}
        </div>
      )}
      <div style={{ fontSize: 14.5, marginBottom: 12, lineHeight: 1.5 }}>{text}</div>
      {children}
    </div>
  );
}