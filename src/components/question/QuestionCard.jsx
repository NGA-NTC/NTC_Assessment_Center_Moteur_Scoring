export default function QuestionCard({ id, dimName, text, children, marginBottom = 12 }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom }}>
      {(id || dimName) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {id && <span style={{ fontFamily: "var(--ntc-font-serif)", color: "var(--secondary)", fontWeight: 600, fontSize: 13.5, flexShrink: 0 }}>{id}</span>}
          {dimName && <span style={{ fontSize: 11, color: "var(--muted-foreground)", alignSelf: "center" }}>· {dimName}</span>}
        </div>
      )}
      <div style={{ fontSize: 14.5, marginBottom: 12, lineHeight: 1.5 }}>{text}</div>
      {children}
    </div>
  );
}