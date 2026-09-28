import { DIM } from "../../data/index.js";
import { ToggleGroup, ToggleGroupItem } from "../ui/primitives/toggle-group.jsx";

const OPTS = [["none", "Non obs."], ["leger", "Léger"], ["modere", "Modéré"], ["fort", "Fort"]];

export default function IntensityToggle({ dimKey, value, onChange }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <div className="w-[150px] shrink-0 text-[12px]">
        <span id={`intensity-label-${dimKey}`}>{DIM[dimKey]?.name}</span>
      </div>
      <ToggleGroup
        type="single"
        size="sm"
        value={value ?? ""}
        onValueChange={(v) => { if (v) onChange(v); }}
        aria-labelledby={`intensity-label-${dimKey}`}
        className="flex-1 gap-1"
      >
        {OPTS.map(([k, label]) => (
          <ToggleGroupItem
            key={k}
            value={k}
            className="h-auto flex-1 rounded-md border border-border bg-card px-0 py-[5px] text-[11px] font-normal text-muted-foreground hover:bg-card hover:text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}