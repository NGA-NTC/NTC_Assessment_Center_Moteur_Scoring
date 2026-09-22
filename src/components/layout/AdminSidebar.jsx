import { FileJson } from "lucide-react";
import SearchField from "../ui/SearchField.jsx";
import FilterDropdown from "../ui/FilterDropdown.jsx";
import UserAvatar from "./UserAvatar.jsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "../ui/Sidebar.jsx";
import { useSidebar } from "../ui/primitives/sidebar-context.js";
import { cn } from "@/lib/utils";

export default function AdminSidebar({
  candidates = [],
  selectedId = null,
  onSelect,
  query = "",
  onQueryChange,
  filters = { type: "all", progress: "all" },
  onFilters,
  metiers = [],
  axes = [],
  onHome,
  onNavigate,
}) {
  const { setOpenMobile } = useSidebar();

  const select = (c) => {
    onSelect(c);
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <button
          type="button"
          onClick={onHome}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 py-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
            <span className="font-serif text-[15px] font-bold">N</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-serif text-[15px] leading-tight font-semibold">
              NTC Assessment
            </span>
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
              Espace administrateur
            </span>
          </span>
        </button>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-1">
          <SearchField value={query} onChange={onQueryChange} placeholder="Rechercher un candidat…" />
          <div className="mt-2">
            <FilterDropdown full filters={filters} onFilters={onFilters} metiers={metiers} axes={axes} />
          </div>
        </div>

        <div className="px-1 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.6px] text-muted-foreground">
          Candidats ({candidates.length})
        </div>
        {candidates.length === 0 && (
          <p className="px-2 py-2 text-[12.5px] leading-[1.6] text-muted-foreground">
            Aucun candidat correspondant aux critères actuels.
          </p>
        )}
        <SidebarMenu>
          {candidates.map((c) => {
            const isActive = selectedId === c.id;
            return (
              <SidebarMenuItem key={c.id}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => select(c)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-none px-2 py-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                    isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  )}
                >
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[12px] font-bold text-sidebar-accent-foreground">
                    {c.kind === "acct" ? c.label.charAt(0).toUpperCase() : <FileJson size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {c.label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {c.kind === "acct" ? "Compte" : "Importé"} · {c.progress.answered}/{c.progress.total}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{c.progress.pct}%</span>
                </button>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <UserAvatar variant="sidebar" onNavigate={onNavigate} />
      </SidebarFooter>
    </Sidebar>
  );
}