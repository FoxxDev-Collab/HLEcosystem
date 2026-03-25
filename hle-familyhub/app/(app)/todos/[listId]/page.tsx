import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdMembersWithRelationships } from "@/lib/household";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Calendar,
  User,
} from "lucide-react";
import {
  addItemAction,
  toggleItemAction,
  deleteItemAction,
  deleteListAction,
} from "../actions";
import { formatDateShort } from "@/lib/format";

export default async function TodoListDetailPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const list = await prisma.todoList.findFirst({
    where: { id: listId, householdId },
    include: {
      items: {
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!list) notFound();

  const members = await getHouseholdMembersWithRelationships(householdId);
  const memberMap = new Map(members.map((m) => [m.userId, m.displayName || m.userName]));

  const pendingItems = list.items.filter((i) => i.status !== "DONE");
  const doneItems = list.items.filter((i) => i.status === "DONE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/todos">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <div
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: list.color || "#6b7280" }}
              />
              <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
            </div>
            {list.description && (
              <p className="text-muted-foreground ml-5">{list.description}</p>
            )}
          </div>
        </div>
        <form action={deleteListAction}>
          <input type="hidden" name="listId" value={list.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            title="Delete list"
          >
            <Trash2 className="size-4" />
          </Button>
        </form>
      </div>

      {/* Add new item */}
      <Card>
        <CardContent className="pt-6">
          <form action={addItemAction} className="flex flex-col gap-3">
            <input type="hidden" name="listId" value={list.id} />
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  name="title"
                  placeholder="Add a task..."
                  required
                />
              </div>
              <div className="w-full sm:w-40">
                <Input
                  name="dueDate"
                  type="date"
                  className="text-sm"
                />
              </div>
              <div className="w-full sm:w-44">
                <Select name="assigneeId">
                  <SelectTrigger>
                    <SelectValue placeholder="Assign to..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.displayName || m.userName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                <Plus className="size-4 mr-1" />
                Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Pending items */}
      {pendingItems.length === 0 && doneItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-12 text-center">
          <CheckCircle2 className="size-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">No tasks yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a task above to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/30 transition-colors"
            >
              <form action={toggleItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <button type="submit" className="text-muted-foreground hover:text-primary transition-colors">
                  <Circle className="size-5" />
                </button>
              </form>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{item.title}</p>
                {item.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-1">{item.notes}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {item.dueDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatDateShort(item.dueDate)}
                    </span>
                  )}
                  {item.assigneeId && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="size-3" />
                      {memberMap.get(item.assigneeId) ?? "Unknown"}
                    </span>
                  )}
                </div>
              </div>
              <form action={deleteItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <button
                  type="submit"
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="size-4" />
                </button>
              </form>
            </div>
          ))}

          {/* Completed items */}
          {doneItems.length > 0 && (
            <div className="pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Completed ({doneItems.length})
              </p>
              {doneItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border p-3 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <form action={toggleItemAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit" className="text-primary hover:text-primary/80 transition-colors">
                      <CheckCircle2 className="size-5" />
                    </button>
                  </form>
                  <div className="flex-1 min-w-0">
                    <p className="line-through text-muted-foreground">{item.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {item.assigneeId && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="size-3" />
                          {memberMap.get(item.assigneeId) ?? "Unknown"}
                        </span>
                      )}
                    </div>
                  </div>
                  <form action={deleteItemAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
