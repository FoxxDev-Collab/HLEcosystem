"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Pause,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileUp,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/format";
import { useUpload, type UploadItem } from "@/components/upload-context";

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "";
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(bytesRemaining: number, bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "";
  const seconds = Math.ceil(bytesRemaining / bytesPerSecond);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`;
}

export function UploadPanel() {
  const {
    uploads,
    retryUpload,
    cancelUpload,
    removeUpload,
    clearCompleted,
    retryAllFailed,
  } = useUpload();
  const [collapsed, setCollapsed] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (uploads.length === 0) return null;

  const doneCount = uploads.filter((u) => u.status === "done").length;
  const errorCount = uploads.filter(
    (u) => u.status === "error" || u.status === "cancelled"
  ).length;
  const activeUploads = uploads.filter((u) => u.status === "uploading");
  const queuedCount = uploads.filter((u) => u.status === "queued").length;
  const isActive = activeUploads.length > 0 || queuedCount > 0;
  const pendingCount = activeUploads.length + queuedCount;

  // Aggregate progress
  const trackedUploads = uploads.filter(
    (u) => u.status === "uploading" || u.status === "done"
  );
  const totalBytes = trackedUploads.reduce((s, u) => s + u.file.size, 0);
  const loadedBytes = trackedUploads.reduce(
    (s, u) => s + (u.file.size * u.progress) / 100,
    0
  );
  const aggregateProgress =
    totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;

  // Minimized: just a small pill
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 rounded-full bg-card border shadow-lg px-4 py-2 hover:bg-accent transition-colors"
        >
          {isActive ? (
            <Loader2 className="size-4 text-primary animate-spin" />
          ) : errorCount > 0 ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : (
            <CheckCircle2 className="size-4 text-green-500" />
          )}
          <span className="text-sm font-medium">
            {isActive ? `${pendingCount} uploading` : `${doneCount} done`}
          </span>
          {isActive && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {aggregateProgress}%
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-lg border bg-card shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {isActive ? (
            <Loader2 className="size-4 text-primary animate-spin shrink-0" />
          ) : errorCount > 0 ? (
            <AlertCircle className="size-4 text-destructive shrink-0" />
          ) : (
            <CheckCircle2 className="size-4 text-green-500 shrink-0" />
          )}
          <span className="text-sm font-medium truncate">
            {isActive
              ? `Uploading ${pendingCount} file${pendingCount !== 1 ? "s" : ""}...`
              : errorCount > 0
                ? `${doneCount} uploaded, ${errorCount} failed`
                : `${doneCount} file${doneCount !== 1 ? "s" : ""} uploaded`}
          </span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <span className="text-xs text-muted-foreground tabular-nums mr-1">
              {aggregateProgress}%
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            {collapsed ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
          <button
            onClick={() => setMinimized(true)}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            <Minimize2 className="size-3.5" />
          </button>
          {!isActive && (
            <button
              onClick={clearCompleted}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              title="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Aggregate progress */}
      {isActive && (
        <div className="px-4 py-1.5">
          <Progress value={aggregateProgress} className="h-1" />
        </div>
      )}

      {/* File list */}
      {!collapsed && (
        <div className="border-t">
          {/* Quick actions */}
          {(errorCount > 0 || doneCount > 0) && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/20">
              {errorCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={retryAllFailed}
                >
                  <RotateCcw className="size-3 mr-1" />
                  Retry failed
                </Button>
              )}
              {doneCount > 0 && !isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={clearCompleted}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto divide-y">
            {uploads.map((upload) => (
              <UploadRow
                key={upload.id}
                upload={upload}
                onRetry={() => retryUpload(upload.id)}
                onCancel={() => cancelUpload(upload.id)}
                onRemove={() => removeUpload(upload.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadRow({
  upload,
  onRetry,
  onCancel,
  onRemove,
}: {
  upload: UploadItem;
  onRetry: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const bytesRemaining = upload.file.size * ((100 - upload.progress) / 100);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 group">
      {/* Status icon */}
      <div className="shrink-0">
        {upload.status === "uploading" && (
          <FileUp className="size-4 text-primary" />
        )}
        {upload.status === "queued" && (
          <Loader2 className="size-4 text-muted-foreground" />
        )}
        {upload.status === "done" && (
          <CheckCircle2 className="size-4 text-green-500" />
        )}
        {(upload.status === "error" || upload.status === "cancelled") && (
          <AlertCircle className="size-4 text-destructive" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs truncate">{upload.file.name}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {formatFileSize(upload.file.size)}
          </span>
        </div>

        {upload.status === "uploading" && (
          <div className="flex items-center gap-2 mt-1">
            <Progress value={upload.progress} className="h-1 flex-1" />
            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              {upload.progress}%
              {upload.speed ? ` · ${formatSpeed(upload.speed)}` : ""}
              {upload.speed ? ` · ${formatEta(bytesRemaining, upload.speed)}` : ""}
            </span>
          </div>
        )}

        {upload.status === "queued" && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Queued</p>
        )}

        {upload.status === "error" && upload.error && (
          <p className="text-[10px] text-destructive mt-0.5 truncate">{upload.error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center shrink-0">
        {upload.status === "uploading" && (
          <button
            onClick={onCancel}
            className="p-1 rounded text-muted-foreground hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <Pause className="size-3" />
          </button>
        )}
        {upload.status === "queued" && (
          <button
            onClick={onCancel}
            className="p-1 rounded text-muted-foreground hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <X className="size-3" />
          </button>
        )}
        {(upload.status === "error" || upload.status === "cancelled") && (
          <button onClick={onRetry} className="p-1 rounded text-muted-foreground hover:text-foreground">
            <RotateCcw className="size-3" />
          </button>
        )}
        {upload.status !== "uploading" && upload.status !== "queued" && (
          <button
            onClick={onRemove}
            className="p-1 rounded text-muted-foreground hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}
