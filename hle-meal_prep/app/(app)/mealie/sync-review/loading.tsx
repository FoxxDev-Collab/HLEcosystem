import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ChefHat, Loader2 } from "lucide-react";

export default function SyncReviewLoading() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-16 rounded-md" />
        <div>
          <Skeleton className="h-7 w-[250px] mb-1" />
          <Skeleton className="h-4 w-[180px]" />
        </div>
      </div>

      {/* Loading indicator */}
      <Card>
        <CardContent className="py-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <ChefHat className="size-12 text-muted-foreground" />
              <Loader2 className="size-6 text-primary animate-spin absolute -bottom-1 -right-1" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Fetching Ingredients from Mealie</h3>
              <p className="text-sm text-muted-foreground">
                Loading recipes and parsing ingredients. This may take a moment for large meal plans...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skeleton items */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="size-5 rounded mt-1 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[300px]" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
