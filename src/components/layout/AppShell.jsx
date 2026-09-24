import { useNavigate } from "react-router-dom";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "../ui/Sidebar.jsx";
import UserAvatar from "./UserAvatar.jsx";
import useFocusReset from "../../hooks/ui/useFocusReset.js";
import { cn } from "@/lib/utils";

export default function AppShell({
  sidebar,
  children,
  maxWidth = 900,
  header = true,
}) {
  const navigate = useNavigate();

  useFocusReset();

  return (
    <SidebarProvider defaultOpen>
      {sidebar}
      <SidebarInset>
        {header && (
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
            {sidebar ? <SidebarTrigger /> : <div className="w-7" />}
            <span className="hidden text-[15px] font-semibold text-foreground sm:block">
              NTC Assessment
            </span>
            <div className="ml-auto flex items-center gap-3">
              <UserAvatar onNavigate={navigate} />
            </div>
          </header>
        )}
        <div
          className={cn("w-full min-w-0 flex-1")}
          style={{
            maxWidth: maxWidth ?? "none",
            margin: "0 auto",
            width: "100%",
            padding: "28px 26px",
          }}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}