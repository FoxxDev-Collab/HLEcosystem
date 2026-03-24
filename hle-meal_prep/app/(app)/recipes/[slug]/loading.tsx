import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function RecipeDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-4 w-[120px]" />

      {/* Header */}
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Skeleton className="aspect-video rounded-lg" />
        <div className="space-y-4">
          <div>
            <Skeleton className="h-8 w-[300px] mb-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mt-1" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-5 w-[100px]" />
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-5 w-[90px]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[130px]" />
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[160px]" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
