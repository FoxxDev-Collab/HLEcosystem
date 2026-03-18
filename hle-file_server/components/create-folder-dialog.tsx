"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFolderAction } from "@/app/(app)/browse/actions";

type CreateFolderDialogProps = {
  parentFolderId?: string | null;
  isPersonal?: boolean;
  trigger: ReactNode;
};

export function CreateFolderDialog({
  parentFolderId,
  isPersonal,
  trigger,
}: CreateFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await createFolderAction(formData);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Create a new folder to organize your files.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {parentFolderId && (
            <input type="hidden" name="parentFolderId" value={parentFolderId} />
          )}
          {isPersonal && (
            <input type="hidden" name="isPersonal" value="true" />
          )}
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              name="name"
              placeholder="Enter folder name"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="folder-color">Color (optional)</Label>
            <Input
              id="folder-color"
              name="color"
              type="color"
              defaultValue="#6366f1"
              className="h-10 w-20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create Folder"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
