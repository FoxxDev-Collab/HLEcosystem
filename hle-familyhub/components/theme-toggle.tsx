"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

// No mounted guard is needed: next-themes returns theme=undefined on both
// the server render and the initial client render, so no hydration mismatch
// occurs. After hydration, next-themes reads localStorage and re-renders with
// the resolved theme. The previous useEffect-based mounted guard triggered
// React 19's react-hooks/set-state-in-effect rule.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${theme === "light" ? "bg-background shadow-sm" : ""}`}
        onClick={() => setTheme("light")}
        title="Light"
      >
        <Sun className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${theme === "system" ? "bg-background shadow-sm" : ""}`}
        onClick={() => setTheme("system")}
        title="System"
      >
        <Monitor className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${theme === "dark" ? "bg-background shadow-sm" : ""}`}
        onClick={() => setTheme("dark")}
        title="Dark"
      >
        <Moon className="size-3.5" />
      </Button>
    </div>
  );
}
