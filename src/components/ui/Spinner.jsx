import { Loader2 } from "lucide-react";
import { NAVY } from "../../lib/theme.js";

export default function Spinner({ size = 20, color = NAVY, className = "", ...props }) {
  return <Loader2 size={size} color={color} className={`ntc-spin ${className}`.trim()} {...props} />;
}