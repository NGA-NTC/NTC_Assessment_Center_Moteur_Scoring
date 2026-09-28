export default function InfoCallout({ children }) {
  return (
    <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12.5, color: "var(--foreground)" }}>
      {children}
    </div>
  );
}