"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const statuses = [
  { label: "All", value: undefined },
  { label: "Planning", value: "PLANNING" },
  { label: "Booked", value: "BOOKED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
] as const;

export function TripFilters({ activeStatus }: { activeStatus?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => (
        <Button
          key={s.label}
          variant={activeStatus === s.value ? "default" : "outline"}
          size="sm"
          asChild
        >
          <Link href={s.value ? `/trips?status=${s.value}` : "/trips"}>
            {s.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
