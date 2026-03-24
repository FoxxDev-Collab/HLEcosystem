import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tags, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { createTagAction, deleteTagAction } from "./actions";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export default async function TagsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const tags = await prisma.tag.findMany({
    where: { householdId },
    include: { _count: { select: { files: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-muted-foreground">Organize files with tags</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5" />
            New Tag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTagAction} className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                name="name"
                placeholder="Enter tag name..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <label key={color} className="cursor-pointer">
                    <input
                      type="radio"
                      name="color"
                      value={color}
                      className="sr-only peer"
                    />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="size-5" />
            All Tags ({tags.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No tags yet. Create one above to get started.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: tag.color || "#6b7280",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{tag.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="size-3" />
                        {tag._count.files} {tag._count.files === 1 ? "file" : "files"}
                      </p>
                    </div>
                  </div>
                  <form action={deleteTagAction}>
                    <input type="hidden" name="tagId" value={tag.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                      title="Delete tag"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
