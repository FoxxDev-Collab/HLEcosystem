"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpload } from "@/components/upload-context";

type UploadDropzoneProps = {
  folderId?: string | null;
  isPersonal?: boolean;
};

export function UploadDropzone({ folderId, isPersonal }: UploadDropzoneProps) {
  const { enqueueFiles } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;
      enqueueFiles(files, folderId, isPersonal);
    },
    [enqueueFiles, folderId, isPersonal]
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
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-4 transition-all",
        isDragOver
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/25 hover:border-muted-foreground/40"
      )}
    >
      <Upload className="size-5 text-muted-foreground shrink-0" />
      <p className="text-sm text-muted-foreground">
        Drop files here or{" "}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-primary font-medium hover:underline"
        >
          browse
        </button>
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
