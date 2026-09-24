export default function PageContainer({ maxWidth = 900, children, style, className }) {
  return (
    <div className={className} style={{ width: "100%", maxWidth, margin: "0 auto", ...style }}>
      {children}
    </div>
  );
}