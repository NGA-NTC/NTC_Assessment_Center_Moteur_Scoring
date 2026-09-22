import { MoreVertical } from "lucide-react";
import DropdownMenu from "./DropdownMenu.jsx";
import { colors, radius } from "../../lib/theme.js";

function prevent(e) {
  e.stopPropagation();
  e.preventDefault();
}

export default function RowMenu({ items }) {
  return (
    <DropdownMenu
      items={items}
      width={220}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label="Options"
          aria-expanded={open}
          onClick={(e) => {
            prevent(e);
            toggle();
          }}
          onMouseDown={prevent}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: radius.sm,
            border: "none",
            background: "transparent",
            color: colors.mutedForeground,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <MoreVertical size={17} />
        </button>
      )}
    />
  );
}