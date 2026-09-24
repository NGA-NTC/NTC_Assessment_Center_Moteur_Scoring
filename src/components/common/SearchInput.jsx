import { Search } from "lucide-react";
import { Input } from "../ui/primitives/input.jsx";
import { cn } from "@/lib/utils";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  size = "md",
  style,
  className,
  disabled,
  autoFocus,
}) {
  const isSmall = size === "sm";
  return (
    <div className="relative min-w-0 flex-1" style={style}>
      <Search
        size={isSmall ? 14 : 15}
        className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className={cn(
          "h-11 rounded-sm border-border bg-surface pl-[34px] pr-3 font-sans text-[13.5px] text-foreground",
          isSmall && "h-9",
          className
        )}
      />
    </div>
  );
}