import { Badge as BaseBadge } from "./primitives/badge.jsx";
import { cn } from "@/lib/utils";

export default function Badge({ children, tone = "neutral", style, className, ...props }) {
  return (
    <BaseBadge variant={tone} className={cn(className)} style={style} {...props}>
      {children}
    </BaseBadge>
  );
}