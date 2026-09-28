import { Moon, Sun } from "lucide-react";
import { Button } from "../ui/primitives/button.jsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/primitives/tooltip.jsx";
import { useTheme } from "../../context/theme-hooks.js";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
            className="size-9 border-border bg-card text-muted-foreground shadow-none hover:text-foreground"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Moon /> : <Sun />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isDark ? "Passer en thème clair" : "Passer en thème sombre"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}