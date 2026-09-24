import { Card as CardPrimitive } from "./primitives/card.jsx";
import { cn } from "@/lib/utils";

export default function Card({ children, onClick, style, variant = "default", className, ...props }) {
  return (
    <CardPrimitive
      {...props}
      onClick={onClick}
      className={cn(
        "block gap-0 p-0",
        variant === "flat" ? "bg-background shadow-none" : "bg-surface shadow-card",
        onClick && "ntc-card-interactive",
        className
      )}
      style={style}
    >
      {children}
    </CardPrimitive>
  );
}