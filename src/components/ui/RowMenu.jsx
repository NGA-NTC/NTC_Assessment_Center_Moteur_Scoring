import { MoreVertical } from "lucide-react";
import DropdownMenu from "./DropdownMenu.jsx";
import { cn } from "@/lib/utils";

function prevent(e) {
  e.stopPropagation();
  e.preventDefault();
}

export default function RowMenu({ items }) {
  return (
    <DropdownMenu
      items={items}
      width={220}
      trigger={({ open }) => (
        <button
          type="button"
          aria-label="Options"
          aria-expanded={open}
          onClick={(e) => {
            prevent(e);
          }}
          onMouseDown={prevent}
          className={cn(
            "inline-flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-muted-foreground hover:text-foreground",
            open && "text-foreground"
          )}
        >
          <MoreVertical size={17} />
        </button>
      )}
    />
  );
}