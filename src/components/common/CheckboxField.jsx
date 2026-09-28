import { useId } from "react";
import { Checkbox } from "../ui/primitives/checkbox.jsx";
import { cn } from "@/lib/utils";

/**
 * Ligne checkbox accessible construite sur la primitive shadcn/Radix.
 * - avec label : label cliquable associé via htmlFor, description secondaire ;
 * - sans label : checkbox seule (aria-label requis via `ariaLabel` ou `title`).
 */
export default function CheckboxField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  title,
  ariaLabel,
  className,
  labelClassName,
  children,
}) {
  const generatedId = useId();
  const hasText = label != null || children != null;
  const fieldId = id ?? `cb-${generatedId}`;

  if (!hasText) {
    return (
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={ariaLabel ?? title}
        className={className}
      />
    );
  }

  return (
    <label
      htmlFor={fieldId}
      title={title}
      className={cn(
        "flex items-start gap-2.5 rounded-sm text-[13.5px] text-foreground",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className
      )}
    >
      <Checkbox
        id={fieldId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block leading-snug", labelClassName)}>{label ?? children}</span>
        {description && (
          <span className="block text-[12px] font-normal text-muted-foreground">{description}</span>
        )}
      </span>
    </label>
  );
}
