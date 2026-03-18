"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewToggleProps = {
  view: "grid" | "list";
  onChange: (view: "grid" | "list") => void;
};

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onChange("grid")}
        className={cn(
          "rounded-sm",
          view === "grid" && "bg-accent text-accent-foreground"
        )}
        aria-label="Grid view"
      >
        <LayoutGrid className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onChange("list")}
        className={cn(
          "rounded-sm",
          view === "list" && "bg-accent text-accent-foreground"
        )}
        aria-label="List view"
      >
        <List className="size-3.5" />
      </Button>
    </div>
  );
}
