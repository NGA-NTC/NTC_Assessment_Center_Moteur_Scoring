import { CheckCircle2, LogOut } from "lucide-react";
import { BATTERIES } from "../../data/index.js";
import { progress } from "../../lib/scoring.js";
import ProgressCircle from "../ui/ProgressCircle.jsx";
import Button from "../ui/Button.jsx";
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

export default function BatterySidebar({ active, setActive, responses, userEmail, onLogout, onHome }) {
  const { setOpenMobile } = useSidebar();

  const select = (id) => {
    setActive(id);
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
              Évaluation
            </span>
          </span>
        </button>
        {userEmail && (
          <div className="truncate px-2 text-[12px] text-muted-foreground">{userEmail}</div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {BATTERIES.map((b) => {
            const p = progress(b, responses);
            const isActive = active === b.id;
            return (
              <SidebarMenuItem key={b.id}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => select(b.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-none px-2 py-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                    isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  )}
                >
                  <ProgressCircle done={p.answered} total={p.total}>
                    {p.answered === p.total && p.total > 0 && <CheckCircle2 size={14} className="text-success" />}
                  </ProgressCircle>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">
                      B{b.id} · {b.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {p.answered}/{p.total}
                    </span>
                  </span>
                </button>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <Button variant="outline" size="sm" full onClick={onLogout}>
          <LogOut size={14} />
          <span>Déconnexion</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}