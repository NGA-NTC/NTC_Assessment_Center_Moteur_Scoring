import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "./primitives/input.jsx";
import { Textarea } from "./Textarea.jsx";
import { cn } from "@/lib/utils";

export default function Field({
  label,
  icon,
  right,
  error,
  hint,
  style,
  type = "text",
  multiline,
  rows = 3,
  children,
  ...inputProps
}) {
  const generatedId = useId();
  const fieldId = inputProps.id ?? generatedId;
  const isSelect = type === "select";
  const isTextarea = type === "textarea" || multiline;

  const controlCls = cn(
    "h-11 w-full rounded-sm border bg-surface px-3 font-sans text-sm text-ink",
    error ? "border-destructive" : "border-border",
    icon && "pl-10",
    isTextarea ? "min-h-9 resize-y p-3" : "py-0",
    !right && !isSelect && "pr-3",
    right && "pr-9"
  );

  const labelNode = label ? (
    <label htmlFor={fieldId} className="mb-1.5 block font-sans text-xs font-semibold text-navy">{label}</label>
  ) : null;

  return (
    <div className="mb-4">
      {!isSelect && labelNode}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 items-center">
            {icon}
          </span>
        )}
        {isSelect ? (
          <div>
            {labelNode}
            <select
              {...inputProps}
              id={fieldId}
              className={cn(controlCls, "cursor-pointer appearance-none")}
              style={style}
            >
              {children}
            </select>
            {!right && (
              <ChevronDown
                size={14}
                className="text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
              />
            )}
          </div>
        ) : isTextarea ? (
          <Textarea {...inputProps} id={fieldId} rows={rows} className={controlCls} style={style} />
        ) : (
          <Input
            type={type}
            {...inputProps}
            id={fieldId}
            aria-invalid={error ? "true" : undefined}
            className={controlCls}
            style={style}
          />
        )}
        {right && (
          <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">{right}</span>
        )}
      </div>
      {error ? (
        <span className="mt-[5px] block text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="mt-[5px] block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}