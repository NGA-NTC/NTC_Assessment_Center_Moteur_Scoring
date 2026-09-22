import { Loader2 } from "lucide-react";
import { Button as BaseButton } from "./primitives/button.jsx";
import { cn } from "@/lib/utils";

const VARIANT_MAP = {
  primary: "default",
  gold: "secondary",
  ghost: "ghost",
  outline: "outlineSidebar",
  danger: "destructive",
  outlineDark: "outlineDark",
};

const SIZE_MAP = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

const FONT_SIZES = {
  sm: "text-[12.5px]",
  md: "text-[13.5px]",
  lg: "text-sm",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  full = false,
  loading = false,
  style,
  className,
  disabled,
  ...props
}) {
  return (
    <BaseButton
      {...props}
      data-variant={variant}
      variant={VARIANT_MAP[variant] ?? "default"}
      size={SIZE_MAP[size] ?? "default"}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      className={cn("font-sans", full && "w-full", FONT_SIZES[size] ?? "text-[13.5px]", className)}
      style={style}
    >
      {loading && <Loader2 className={cn("ntc-spin", size === "sm" ? "size-3.5" : "size-4")} />}
      {children}
    </BaseButton>
  );
}