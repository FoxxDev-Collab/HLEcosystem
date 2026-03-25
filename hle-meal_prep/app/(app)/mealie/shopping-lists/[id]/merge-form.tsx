"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Merge, Plus, ShoppingCart, Loader2 } from "lucide-react";
import { mergeToShoppingListAction } from "./actions";

type MealieItem = {
  id: string;
  display: string;
  foodName: string;
  quantity: number;
  unitName: string | null;
  note: string;
  labelName: string | null;
};

type LocalList = {
  id: string;
  name: string;
  status: string;
};

type Props = {
  mealieListId: string;
  mealieListName: string;
  items: MealieItem[];
  localLists: LocalList[];
};

export function MergeForm({ mealieListId, mealieListName, items, localLists }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"new" | "existing">(localLists.length > 0 ? "existing" : "new");
  const [newListName, setNewListName] = useState(mealieListName);
  const [targetListId, setTargetListId] = useState(localLists[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(items.map((i) => i.id))
  );
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === items.length;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleMerge = () => {
    setResult(null);
    const selected = items.filter((i) => selectedIds.has(i.id));

    startTransition(async () => {
      const fd = new FormData();
      fd.append("mode", mode);
      fd.append("mealieListId", mealieListId);
      fd.append("items", JSON.stringify(selected));

      if (mode === "new") {
        fd.append("newListName", newListName);
      } else {
        fd.append("targetListId", targetListId);
      }

      const res = await mergeToShoppingListAction(fd);
      if (res?.error) {
        setResult({ error: res.error });
      } else if (res?.listId) {
        setResult({ success: `Merged ${selectedCount} items` });
        router.push(`/shopping-lists/${res.listId}`);
      }
    });
  };

  return (
    <>
      {/* Selection summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Merge className="size-4 text-primary" />
            Merge to Shopping List
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Select items from this Mealie list to add to a local shopping list. Products will be created automatically if they don&apos;t exist.
          </p>

          <Separator />

          {/* Item selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Items to merge</Label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[10px] text-primary hover:underline"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="max-h-[300px] overflow-auto space-y-1 mp-scroll">
              {items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <span className="text-xs truncate flex-1">{item.display || item.foodName}</span>
                  {item.labelName && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">
                      {item.labelName}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {selectedCount} of {items.length} selected
            </p>
          </div>

          <Separator />

          {/* Target selection */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "existing" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setMode("existing")}
                disabled={localLists.length === 0}
              >
                <ShoppingCart className="size-3 mr-1" />
                Existing list
              </Button>
              <Button
                type="button"
                variant={mode === "new" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setMode("new")}
              >
                <Plus className="size-3 mr-1" />
                New list
              </Button>
            </div>

            {mode === "existing" && localLists.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Target list</Label>
                <Select value={targetListId} onValueChange={setTargetListId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {localLists.map((l) => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">
                        {l.name}
                        <Badge variant="outline" className="ml-2 text-[8px] px-1 py-0">
                          {l.status}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "new" && (
              <div className="space-y-1.5">
                <Label className="text-xs">List name</Label>
                <Input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Shopping list name"
                />
              </div>
            )}
          </div>

          {/* Error/success */}
          {result?.error && (
            <p className="text-xs text-destructive">{result.error}</p>
          )}
          {result?.success && (
            <p className="text-xs text-primary">{result.success}</p>
          )}

          {/* Merge button */}
          <Button
            onClick={handleMerge}
            disabled={isPending || selectedCount === 0 || (mode === "new" && !newListName.trim()) || (mode === "existing" && !targetListId)}
            className="w-full"
            size="sm"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="size-3.5 mr-1.5" />
                Merge {selectedCount} item{selectedCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
