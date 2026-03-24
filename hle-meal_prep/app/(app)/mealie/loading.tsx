import { Skeleton } from "@/components/ui/skeleton";

export default function MealieLoading() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <Skeleton className="h-9 w-[180px] rounded-md" />
      </div>

      {/* Calendar skeleton */}
      <div className="rounded-xl border overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="py-2.5 flex justify-center">
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
        {/* Calendar cells — 5 rows */}
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, idx) => (
            <div
              key={idx}
              className={`min-h-[130px] p-2 ${
                (idx + 1) % 7 !== 0 ? "border-r border-border/50" : ""
              } ${idx < 28 ? "border-b border-border/50" : ""}`}
            >
              <Skeleton className="h-4 w-5 mb-2" />
              {idx % 3 === 0 && <Skeleton className="h-12 w-full rounded-md" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
