import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getMealieShoppingLists, getMealieConfig } from "@/lib/mealie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowRight, ExternalLink, ListChecks } from "lucide-react";

export default async function MealieShoppingListsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const config = await getMealieConfig(householdId);
  if (!config) {
    return (
      <div className="space-y-6 max-w-[1200px]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mealie Shopping Lists</h1>
          <p className="text-muted-foreground text-sm">Connect Mealie to view shopping lists</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <ShoppingCart className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">Mealie not connected</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              Connect your Mealie instance in Settings to sync shopping lists.
            </p>
            <Button asChild>
              <Link href="/settings">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  let lists: Awaited<ReturnType<typeof getMealieShoppingLists>> = [];
  let error: string | null = null;
  try {
    lists = await getMealieShoppingLists(householdId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch shopping lists";
  }

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mealie Shopping Lists</h1>
          <p className="text-muted-foreground text-sm">
            {lists.length} list{lists.length !== 1 ? "s" : ""} from Mealie
          </p>
        </div>
        <a
          href={`${config.apiUrl}/g/home/shopping-lists`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            <ExternalLink className="size-3.5 mr-1.5" />
            Open in Mealie
          </Button>
        </a>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {lists.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <ListChecks className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">No shopping lists</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create a shopping list in Mealie and it will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {lists.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Link key={list.id} href={`/mealie/shopping-lists/${list.id}`}>
              <Card className="store-card h-full hover:bg-accent/30 transition-colors cursor-pointer"
                style={{ "--store-color": "var(--primary)" } as React.CSSProperties}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShoppingCart className="size-4 text-primary" />
                    {list.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] text-muted-foreground">
                    Updated {new Date(list.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                    View items
                    <ArrowRight className="size-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
