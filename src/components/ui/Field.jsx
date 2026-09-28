import * as React from "react";
import { useId } from "react";
import { Input } from "./primitives/input.jsx";
import { Textarea } from "./Textarea.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./primitives/select.jsx";
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
    "h-11 w-full rounded-sm border bg-card px-3 font-sans text-sm text-foreground",
    error ? "border-destructive" : "border-border",
    icon && "pl-10",
    isTextarea ? "min-h-9 resize-y p-3" : "py-0",
    !right && !isSelect && "pr-3",
    right && "pr-9"
  );

  const labelNode = label ? (
    <label htmlFor={fieldId} className="mb-1.5 block font-sans text-xs font-semibold text-primary">{label}</label>
  ) : null;

  const selectValue = typeof inputProps.value === "string" || typeof inputProps.value === "number"
    ? String(inputProps.value)
    : inputProps.value;
  const placeholder = inputProps.placeholder;

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
            <Select value={selectValue} onValueChange={(v) => {
              inputProps.onValueChange?.(v);
              if (typeof inputProps.onChange === "function") inputProps.onChange({ target: { value: v } });
            }}>
              <SelectTrigger
                id={fieldId}
                className={cn(
                  "w-full rounded-sm bg-card",
                  error && "border-destructive aria-invalid:border-destructive",
                  icon && "pl-10"
                )}
                style={style}
                aria-invalid={error ? "true" : undefined}
              >
                <SelectValue placeholder={placeholder ?? "Sélectionner…"} />
              </SelectTrigger>
              <SelectContent>
                {React.Children.map(children, (child) => {
                  if (React.isValidElement(child) && child.type === "option") {
                    return (
                      <SelectItem key={child.props.value} value={String(child.props.value)}>
                        {child.props.children}
                      </SelectItem>
                    );
                  }
                  return child;
                })}
              </SelectContent>
            </Select>
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