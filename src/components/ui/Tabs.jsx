import { Tabs as TabsRoot, TabsList, TabsTrigger } from "./primitives/tabs.jsx";
import { cn } from "@/lib/utils";

export default function Tabs({ items = [], active, onChange, variant = "underline", style, className }) {
  const pills = variant === "pills";
  return (
    <TabsRoot
      value={active}
      onValueChange={(id) => onChange?.(id)}
      className={cn("flex flex-row flex-wrap", pills ? "gap-2" : "gap-0.5 border-b border-border", className)}
      style={style}
    >
      <TabsList
        className={cn(
          "h-auto w-full items-center justify-start rounded-none bg-transparent p-0",
          pills ? "gap-2" : "gap-0.5"
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className={cn(
                "inline-flex flex-none cursor-pointer items-center gap-1.5 font-sans text-[13px] font-semibold transition-all" +
                  " [&_svg:not([class*='size-'])]:size-3.5 h-auto border-0 border-b-2",
                pills
                  ? "rounded-sm px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
                  : "rounded-none px-3.5 py-2.5 -mb-px data-[state=active]:border-b-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                !active || active === item.id
                  ? ""
                  : pills
                    ? "bg-transparent text-muted-foreground hover:text-navy"
                    : "border-b-transparent text-muted-foreground hover:text-navy"
              )}
            >
              {Icon && <Icon size={14} />}
              <span>{item.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </TabsRoot>
  );
}