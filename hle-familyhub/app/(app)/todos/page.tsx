import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, ListTodo, CheckCircle2, Circle } from "lucide-react";
import { createListAction } from "./actions";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export default async function TodosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const lists = await prisma.todoList.findMany({
    where: { householdId },
    include: {
      _count: { select: { items: true } },
      items: {
        select: { status: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">To-Do Lists</h1>
          <p className="text-muted-foreground">Manage tasks for your household</p>
        </div>
      </div>

      {/* Create new list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="size-5" />
            New List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createListAction} className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="list-name">Name</Label>
              <Input
                id="list-name"
                name="name"
                placeholder="e.g. Weekend Chores, Grocery Run..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <label key={color} className="cursor-pointer">
                    <input type="radio" name="color" value={color} className="sr-only peer" />
                    <div
                      className="size-8 sm:size-7 rounded-full border-2 border-transparent peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-offset-background peer-checked:ring-foreground/20 transition-all"
                      style={{ backgroundColor: color }}
                    />
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              <Plus className="size-4 mr-1" />
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lists grid */}
      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-16 text-center">
          <ListTodo className="size-16 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">No lists yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a to-do list above to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => {
            const doneCount = list.items.filter((i) => i.status === "DONE").length;
            const totalCount = list._count.items;
            const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

            return (
              <Link key={list.id} href={`/todos/${list.id}`}>
                <Card className="hover:bg-accent/50 transition-colors h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: list.color || "#6b7280" }}
                      />
                      <CardTitle className="text-base">{list.name}</CardTitle>
                    </div>
                    {list.description && (
                      <CardDescription className="line-clamp-2">
                        {list.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Circle className="size-3" />
                          {totalCount - doneCount} pending
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          {doneCount} done
                        </span>
                      </div>
                      {totalCount > 0 && (
                        <Badge variant={progress === 100 ? "default" : "secondary"}>
                          {progress}%
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
