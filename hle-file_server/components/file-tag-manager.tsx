"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, Tag, Check } from "lucide-react";

type TagInfo = {
  id: string;
  name: string;
  color: string | null;
};

type FileTagInfo = {
  id: string;
  tag: TagInfo;
};

type Props = {
  fileId: string;
  fileTags: FileTagInfo[];
};

export function FileTagManager({ fileId, fileTags }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [open, setOpen] = useState(false);

  // Fetch all household tags when popover opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/files/tags")
      .then((r) => r.json())
      .then((data) => setAllTags(data.tags ?? []))
      .catch(() => {});
  }, [open]);

  const appliedTagIds = new Set(fileTags.map((ft) => ft.tag.id));

  const handleAddTag = (tagId: string) => {
    startTransition(async () => {
      const { addTagToFileAction } = await import("@/app/(app)/tags/actions");
      const fd = new FormData();
      fd.append("fileId", fileId);
      fd.append("tagId", tagId);
      await addTagToFileAction(fd);
      router.refresh();
    });
  };

  const handleRemoveTag = (fileTagId: string) => {
    startTransition(async () => {
      const { removeTagFromFileAction } = await import("@/app/(app)/tags/actions");
      const fd = new FormData();
      fd.append("fileTagId", fileTagId);
      await removeTagFromFileAction(fd);
      router.refresh();
    });
  };

  const availableTags = allTags.filter((t) => !appliedTagIds.has(t.id));

  return (
    <div className={`space-y-2 ${isPending ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="size-4" />
          Tags
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Plus className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            {availableTags.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                {allTags.length === 0
                  ? "No tags created yet. Create tags in the Tags page."
                  : "All tags applied"}
              </p>
            ) : (
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      handleAddTag(tag.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    <div
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color || "#6b7280" }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {fileTags.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tags</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {fileTags.map((ft) => (
            <Badge
              key={ft.id}
              variant="outline"
              className="text-xs gap-1 pr-1 group"
              style={
                ft.tag.color
                  ? { borderColor: ft.tag.color, color: ft.tag.color }
                  : undefined
              }
            >
              {ft.tag.name}
              <button
                onClick={() => handleRemoveTag(ft.id)}
                className="rounded-full p-0.5 hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Simpler version for context menus — just a popover to pick tags
export function TagPickerPopover({
  fileId,
  trigger,
}: {
  fileId: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/files/tags").then((r) => r.json()),
      fetch(`/api/files/${fileId}/tags`).then((r) => r.json()),
    ]).then(([tagsData, fileTagsData]) => {
      setAllTags(tagsData.tags ?? []);
      setAppliedIds(new Set((fileTagsData.tagIds as string[]) ?? []));
    }).catch(() => {});
  }, [open, fileId]);

  const handleToggle = (tagId: string) => {
    const isApplied = appliedIds.has(tagId);
    startTransition(async () => {
      if (isApplied) {
        // Need to find the fileTag id — simpler to just call the action by tagId
        const { removeTagByIdsAction } = await import("@/app/(app)/tags/actions");
        const fd = new FormData();
        fd.append("fileId", fileId);
        fd.append("tagId", tagId);
        await removeTagByIdsAction(fd);
      } else {
        const { addTagToFileAction } = await import("@/app/(app)/tags/actions");
        const fd = new FormData();
        fd.append("fileId", fileId);
        fd.append("tagId", tagId);
        await addTagToFileAction(fd);
      }
      setAppliedIds((prev) => {
        const next = new Set(prev);
        if (isApplied) next.delete(tagId);
        else next.add(tagId);
        return next;
      });
      router.refresh();
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        {allTags.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No tags created yet
          </p>
        ) : (
          <div className={`space-y-0.5 max-h-48 overflow-y-auto ${isPending ? "opacity-60" : ""}`}>
            {allTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleToggle(tag.id)}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <div
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color || "#6b7280" }}
                />
                <span className="truncate flex-1 text-left">{tag.name}</span>
                {appliedIds.has(tag.id) && (
                  <Check className="size-3.5 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
