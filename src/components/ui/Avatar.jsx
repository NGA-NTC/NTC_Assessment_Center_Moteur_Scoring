import { Avatar as AvatarRoot, AvatarFallback } from "./primitives/avatar.jsx";
import { cn } from "@/lib/utils";

function resolveInitials(name, email) {
  const n = (name || "").trim().split(/\s+/).filter(Boolean);
  if (n.length >= 2) return (n[0][0] + n[n.length - 1][0]).toUpperCase();
  if (n.length === 1) return n[0][0].toUpperCase();
  return email?.[0]?.toUpperCase() || "U";
}

export default function Avatar({
  name = "",
  email = "",
  initials: initialsProp,
  size = 36,
  gradient = false,
  style,
  className,
  ...props
}) {
  const initials = initialsProp ?? resolveInitials(name, email);
  return (
    <AvatarRoot
      {...props}
      aria-hidden="true"
      className={cn("size-9", className)}
      style={{ width: size, height: size, ...style }}
    >
      <AvatarFallback
        className={cn(
          "font-bold text-white select-none",
          gradient ? "bg-gradient-to-br from-navy to-gold" : "bg-navy",
          size >= 40 ? "text-sm" : "text-[13px]"
        )}
      >
        {initials}
      </AvatarFallback>
    </AvatarRoot>
  );
}