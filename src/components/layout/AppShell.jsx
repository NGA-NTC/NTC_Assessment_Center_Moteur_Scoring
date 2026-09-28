import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "../ui/Sidebar.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import useFocusReset from "../../hooks/ui/useFocusReset.js";
import { Button } from "../ui/primitives/button.jsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/primitives/tooltip.jsx";
import { cn } from "@/lib/utils";

export default function AppShell({
  sidebar,
  children,
  maxWidth = 900,
  header = true,
}) {
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
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      aria-label="Paramètres du compte"
                      className="size-9 border-border bg-card text-muted-foreground shadow-none hover:text-foreground"
                    >
                      <Link to="/compte">
                        <Settings />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Paramètres du compte</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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