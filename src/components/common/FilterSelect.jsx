import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/primitives/select.jsx";
import { cn } from "@/lib/utils";

export default function FilterSelect({
  value,
  onValueChange,
  options = [],
  placeholder = "Sélectionner…",
  ariaLabel,
  size = "default",
  className,
  triggerClass,
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size={size}
        aria-label={ariaLabel}
        className={cn("min-w-[160px] rounded-sm bg-surface", triggerClass)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={className}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}