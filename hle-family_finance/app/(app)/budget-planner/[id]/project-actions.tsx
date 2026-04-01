"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { updateProjectAction, deleteProjectAction, updateItemAction } from "../actions";

type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  targetDate: Date | null;
  color: string | null;
};

type ItemData = {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  referenceUrl: string | null;
  description: string | null;
};

export function ProjectEditDialog({ project }: { project: ProjectData }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await updateProjectAction(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
      router.refresh();
    }
  }

  const targetDateStr = project.targetDate
    ? new Date(project.targetDate).toISOString().split("T")[0]
    : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4 mr-2" />Edit Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project details.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={project.id} />
          <div className="space-y-1">
            <Label>Name</Label>
            <Input name="name" defaultValue={project.name} required />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input name="description" defaultValue={project.description ?? ""} placeholder="Optional details" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Target Date</Label>
              <Input name="targetDate" type="date" defaultValue={targetDateStr} />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input name="color" type="color" defaultValue={project.color || "#6366f1"} className="h-9" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDeleteDialog({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4 mr-2" />Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete &quot;{projectName}&quot; and all its items? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <form action={deleteProjectAction}>
            <input type="hidden" name="id" value={projectId} />
            <Button type="submit" variant="destructive">Delete Permanently</Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ItemEditDialog({ item }: { item: ItemData }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await updateItemAction(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>Update item details and cost.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />
          <div className="space-y-1">
            <Label>Item Name</Label>
            <Input name="name" defaultValue={item.name} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input name="quantity" type="number" min="1" defaultValue={item.quantity} required />
            </div>
            <div className="space-y-1">
              <Label>Unit Cost</Label>
              <Input name="unitCost" type="number" step="0.01" min="0" defaultValue={Number(item.unitCost)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Reference URL</Label>
            <Input name="referenceUrl" defaultValue={item.referenceUrl ?? ""} placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input name="description" defaultValue={item.description ?? ""} placeholder="Optional notes" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
