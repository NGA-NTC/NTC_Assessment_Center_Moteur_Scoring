export default function OptionButton({ letter, text, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="font-sans" style={{
      width: "100%", textAlign: "left", display: "flex", gap: 10, alignItems: "flex-start",
      padding: "10px 13px", marginBottom: 6, borderRadius: 8, cursor: "pointer",
      border: selected ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
      background: selected ? "var(--primary)" : "var(--card)", color: selected ? "var(--primary-foreground)" : "var(--foreground)", transition: "all .12s",
    }}>
      <span style={{ fontWeight: 700, fontSize: 12.5, opacity: selected ? 1 : 0.55, flexShrink: 0, marginTop: 1 }}>{letter}</span>
      <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{text}</span>
    </button>
  );
}
