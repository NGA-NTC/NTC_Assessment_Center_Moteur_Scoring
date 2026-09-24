import { useState } from "react";
import {
  DropdownMenu as Menu,
  DropdownMenuTrigger as MenuTrigger,
  DropdownMenuContent as MenuContent,
  DropdownMenuItem as MenuItem,
} from "./primitives/dropdown-menu.jsx";
import { cn } from "@/lib/utils";

export default function DropdownMenu({
  trigger,
  items = [],
  align = "right",
  side = "bottom",
  header,
  width = 220,
  id,
  className,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div id={id} className={cn("relative inline-flex shrink-0", className)}>
      <Menu open={open} onOpenChange={setOpen} modal={false}>
        <MenuTrigger asChild>
          {trigger({ open, close: () => setOpen(false) })}
        </MenuTrigger>
        <MenuContent
          align={align === "right" ? "end" : "start"}
          side={side}
          className="rounded-md p-1.5 shadow-menu"
          style={{ width: `min(92vw, ${width}px)`, zIndex: 50 }}
        >
          {header && (
            <div className="border-b border-line bg-cream px-3 py-2.5 text-[11px] uppercase tracking-[0.5px] text-muted">
              {header}
            </div>
          )}
          {items.map((it, i) => (
            <MenuItem
              key={i}
              data-danger={it.danger ? "true" : "false"}
              onClick={(e) => {
                e.stopPropagation();
                it.onClick?.();
              }}
              className={cn(
                "cursor-pointer",
                it.danger
                  ? "text-destructive-strong data-[highlighted]:bg-destructive-soft data-[highlighted]:text-destructive-strong focus:text-destructive-strong"
                  : "text-foreground data-[highlighted]:bg-line-soft",
                it.className
              )}
            >
              {it.icon && <span className="inline-flex opacity-85">{it.icon}</span>}
              {it.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
