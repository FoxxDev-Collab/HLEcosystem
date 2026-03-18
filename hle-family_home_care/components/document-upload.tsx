"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";

const DOC_TYPES = [
  { value: "MANUAL", label: "Manual" },
  { value: "WARRANTY", label: "Warranty" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PHOTO", label: "Photo" },
  { value: "OTHER", label: "Other" },
];

type UploadProps = {
  itemId?: string;
  vehicleId?: string;
  repairId?: string;
  items?: { id: string; name: string }[];
  vehicles?: { id: string; year: number | null; make: string; model: string }[];
  compact?: boolean;
};

export function DocumentUpload({ itemId, vehicleId, repairId, items, vehicles, compact }: UploadProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleUpload(formData: FormData) {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return;

    setUploading(true);
    setError(null);

    try {
      const uploadData = new FormData();
      uploadData.set("file", file);
      uploadData.set("type", formData.get("type") as string || "OTHER");
      uploadData.set("name", formData.get("name") as string || file.name);
      if (formData.get("notes")) uploadData.set("notes", formData.get("notes") as string);

      const linkedItemId = formData.get("itemId") as string || itemId;
      const linkedVehicleId = formData.get("vehicleId") as string || vehicleId;
      const linkedRepairId = repairId;

      if (linkedItemId) uploadData.set("itemId", linkedItemId);
      if (linkedVehicleId) uploadData.set("vehicleId", linkedVehicleId);
      if (linkedRepairId) uploadData.set("repairId", linkedRepairId);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        return;
      }

      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
    }
  }

  if (compact) {
    return (
      <form action={handleUpload} className="space-y-3">
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="size-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground mb-2">Drop file here or click to browse</p>
          <Input ref={fileRef} name="file" type="file" className="text-xs" required />
        </div>
        <div className="flex gap-2">
          <Select name="type" defaultValue="OTHER">
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={uploading}>
            {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3 mr-1" />}
            Upload
          </Button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>
    );
  }

  return (
    <form action={handleUpload} className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-3">Drag & drop a file, or click to browse</p>
        <Input ref={fileRef} name="file" type="file" className="max-w-xs mx-auto" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div className="space-y-1">
          <Label>Document Name</Label>
          <Input name="name" placeholder="Optional — uses filename" />
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Select name="type" defaultValue="OTHER">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {items && items.length > 0 && (
          <div className="space-y-1">
            <Label>Link to Item</Label>
            <Select name="itemId">
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {vehicles && vehicles.length > 0 && (
          <div className="space-y-1">
            <Label>Link to Vehicle</Label>
            <Select name="vehicleId">
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.year ? `${v.year} ` : ""}{v.make} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>Notes</Label>
          <Input name="notes" placeholder="Optional" />
        </div>
        <Button type="submit" disabled={uploading}>
          {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
          Upload
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
