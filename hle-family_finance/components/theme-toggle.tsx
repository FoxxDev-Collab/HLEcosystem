"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-20" />;

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
