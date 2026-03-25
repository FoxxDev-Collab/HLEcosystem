"use client";

import {
  Users,
  Home,
  DollarSign,
  HeartPulse,
  Wrench,
  HardDrive,
  UtensilsCrossed,
  BookOpen,
} from "lucide-react";

const apps = [
  { key: "MANAGER", name: "Manager", icon: Users, color: "text-blue-600 dark:text-blue-400" },
  { key: "HUB", name: "Hub", icon: Home, color: "text-indigo-600 dark:text-indigo-400" },
  { key: "FINANCE", name: "Finance", icon: DollarSign, color: "text-green-600 dark:text-green-400" },
  { key: "HEALTH", name: "Health", icon: HeartPulse, color: "text-red-600 dark:text-red-400" },
  { key: "HOME", name: "Home Care", icon: Wrench, color: "text-orange-600 dark:text-orange-400" },
  { key: "FILES", name: "Files", icon: HardDrive, color: "text-purple-600 dark:text-purple-400" },
  { key: "MEALS", name: "Meals", icon: UtensilsCrossed, color: "text-amber-600 dark:text-amber-400" },
  { key: "WIKI", name: "Wiki", icon: BookOpen, color: "text-teal-600 dark:text-teal-400" },
];

export type AppUrls = Record<string, string>;

export function AppSwitcher({ currentApp, appUrls }: { currentApp: string; appUrls: AppUrls }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {apps.map((app) => {
        const url = appUrls[app.key];
        if (!url) return null;
        const isCurrent = app.key === currentApp;
        const Icon = app.icon;

        return (
          <a
            key={app.key}
            href={isCurrent ? "#" : `${url}/dashboard`}
            className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center transition-colors ${
              isCurrent
                ? "bg-primary/10 cursor-default"
                : "hover:bg-sidebar-accent cursor-pointer"
            }`}
            title={app.name}
            onClick={isCurrent ? (e) => e.preventDefault() : undefined}
          >
            <Icon className={`size-4 ${isCurrent ? app.color : "text-muted-foreground"}`} />
            <span className={`text-[10px] leading-tight ${isCurrent ? "font-semibold" : "text-muted-foreground"}`}>
              {app.name}
            </span>
          </a>
        );
      })}
    </div>
  );
}
