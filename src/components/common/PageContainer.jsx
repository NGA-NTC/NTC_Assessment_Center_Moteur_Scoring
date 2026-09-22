import { container } from "../../lib/theme.js";

export default function PageContainer({ maxWidth = container.md, children, style, className }) {
  return (
    <div className={className} style={{ width: "100%", maxWidth, margin: "0 auto", ...style }}>
      {children}
    </div>
  );
}