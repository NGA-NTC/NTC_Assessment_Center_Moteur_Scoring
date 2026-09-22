import { NavLink } from "react-router-dom";
import { findNavMatch } from "../../routes/navigation/index.js";
import UserAvatar from "./UserAvatar.jsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/Sidebar.jsx";
import { useSidebar } from "../ui/primitives/sidebar-context.js";
import { cn } from "@/lib/utils";

export default function AppSidebar({
  items = [],
  activePath = "",
  onNavigate,
  sectionLabels = {},
  subtitle = "",
}) {
  const activeItem = findNavMatch(items, activePath);
  const sections = [...new Set(items.map((item) => item.section))];
  const { setOpenMobile } = useSidebar();

  const closeOnMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenuButton size="lg" asChild className="data-[active=true]:bg-transparent">
          <NavLink to={items[0]?.path ?? "/"} onClick={closeOnMobile}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
              <span className="font-serif text-[15px] font-bold">N</span>
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-serif text-[15px] font-semibold">
                NTC Assessment
              </span>
              <span className="truncate text-[10.5px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
                {subtitle || "Plateforme"}
              </span>
            </span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section}>
            <SidebarGroupLabel>
              {sectionLabels[section] ?? section}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = activeItem === item;
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          onClick={closeOnMobile}
                        >
                          <NavLink to={item.path}>
                            {Icon ? <Icon /> : null}
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className={cn("border-t border-sidebar-border p-2")}>
        <UserAvatar variant="sidebar" onNavigate={onNavigate} />
      </SidebarFooter>
    </Sidebar>
  );
}