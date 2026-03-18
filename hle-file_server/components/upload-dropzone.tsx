"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

type UploadingFile = {
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

type UploadDropzoneProps = {
  folderId?: string | null;
  isPersonal?: boolean;
};

export function UploadDropzone({ folderId, isPersonal }: UploadDropzoneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);

  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const newUploads: UploadingFile[] = fileArray.map((f) => ({
        name: f.name,
        size: f.size,
        progress: 0,
        status: "uploading" as const,
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      const formData = new FormData();
      fileArray.forEach((file) => formData.append("files", file));
      if (folderId) formData.append("folderId", folderId);
      if (isPersonal) formData.append("isPersonal", "true");

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploads((prev) =>
          prev.map((u) =>
            newUploads.some((nu) => nu.name === u.name && nu.size === u.size && u.status === "uploading")
              ? { ...u, progress: percent }
              : u
          )
        );
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploads((prev) =>
            prev.map((u) =>
              newUploads.some((nu) => nu.name === u.name && nu.size === u.size && u.status === "uploading")
                ? { ...u, progress: 100, status: "done" as const }
                : u
            )
          );
          router.refresh();
        } else {
          const errorMsg = xhr.statusText || "Upload failed";
          setUploads((prev) =>
            prev.map((u) =>
              newUploads.some((nu) => nu.name === u.name && nu.size === u.size && u.status === "uploading")
                ? { ...u, status: "error" as const, error: errorMsg }
                : u
            )
          );
        }
      });

      xhr.addEventListener("error", () => {
        setUploads((prev) =>
          prev.map((u) =>
            newUploads.some((nu) => nu.name === u.name && nu.size === u.size && u.status === "uploading")
              ? { ...u, status: "error" as const, error: "Network error" }
              : u
          )
        );
      });

      xhr.open("POST", "/api/files/upload");
      xhr.send(formData);
    },
    [folderId, isPersonal, router]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadFiles(e.target.files);
        e.target.value = "";
      }
    },
    [uploadFiles]
  );

  const removeUpload = useCallback((index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <Upload className="size-10 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Upload files to your storage</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Browse Files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div
              key={`${upload.name}-${index}`}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{upload.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(upload.size)}
                    </span>
                    {upload.status === "done" && (
                      <CheckCircle className="size-4 text-green-500" />
                    )}
                    {upload.status === "error" && (
                      <AlertCircle className="size-4 text-destructive" />
                    )}
                    {upload.status !== "uploading" && (
                      <button
                        type="button"
                        onClick={() => removeUpload(index)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="mt-2 h-1.5" />
                )}
                {upload.status === "error" && upload.error && (
                  <p className="text-xs text-destructive mt-1">{upload.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
