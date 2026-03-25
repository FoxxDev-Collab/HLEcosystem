"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

export type UploadStatus = "queued" | "uploading" | "done" | "error" | "cancelled";

export type UploadItem = {
  id: string;
  file: File;
  folderId: string | null;
  isPersonal: boolean;
  progress: number;
  status: UploadStatus;
  error?: string;
  speed?: number;
  startedAt?: number;
  // Internal — not exposed to UI
  _abort?: AbortController;
  _xhr?: XMLHttpRequest;
};

type UploadContextType = {
  uploads: UploadItem[];
  enqueueFiles: (files: File[], folderId?: string | null, isPersonal?: boolean) => void;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  removeUpload: (id: string) => void;
  clearCompleted: () => void;
  retryAllFailed: () => void;
};

const UploadContext = createContext<UploadContextType | null>(null);

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}

const MAX_CONCURRENT = 3;
// Files above this threshold use chunked upload
const CHUNK_THRESHOLD = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const activeCount = useRef(0);
  const queueRef = useRef<UploadItem[]>([]);
  const completedSinceLastInvalidate = useRef(0);

  const updateUpload = useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
      );
    },
    []
  );

  const invalidateFiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    completedSinceLastInvalidate.current = 0;
  }, [queryClient]);

  // ── Chunked upload (for large files) ──
  const uploadChunked = useCallback(
    async (item: UploadItem) => {
      const abortController = new AbortController();
      item._abort = abortController;
      updateUpload(item.id, { _abort: abortController });

      try {
        // 1. Init
        const initRes = await fetch("/api/files/upload/chunked", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "init",
            fileName: item.file.name,
            fileSize: item.file.size,
          }),
          signal: abortController.signal,
        });

        if (!initRes.ok) {
          const body = await initRes.json().catch(() => ({}));
          throw new Error(body.error || `Init failed (${initRes.status})`);
        }

        const { uploadId } = await initRes.json();
        const totalChunks = Math.ceil(item.file.size / CHUNK_SIZE);
        let uploadedBytes = 0;
        let lastTime = Date.now();
        let lastBytes = 0;

        // 2. Upload chunks sequentially
        for (let i = 0; i < totalChunks; i++) {
          if (abortController.signal.aborted) throw new Error("Cancelled");

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, item.file.size);
          const chunk = item.file.slice(start, end);

          const chunkRes = await fetch("/api/files/upload/chunked", {
            method: "PUT",
            headers: {
              "x-upload-id": uploadId,
              "x-chunk-index": String(i),
              "Content-Type": "application/octet-stream",
            },
            body: chunk,
            signal: abortController.signal,
          });

          if (!chunkRes.ok) {
            const body = await chunkRes.json().catch(() => ({}));
            throw new Error(body.error || `Chunk ${i} failed (${chunkRes.status})`);
          }

          uploadedBytes += (end - start);
          const progress = Math.round((uploadedBytes / item.file.size) * 100);

          // Speed calculation
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          let speed: number | undefined;
          if (elapsed > 0.5) {
            speed = (uploadedBytes - lastBytes) / elapsed;
            lastBytes = uploadedBytes;
            lastTime = now;
          }

          updateUpload(item.id, {
            progress,
            ...(speed !== undefined ? { speed } : {}),
          });
        }

        // 3. Complete — assemble on server
        const completeRes = await fetch("/api/files/upload/chunked", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            uploadId,
            fileName: item.file.name,
            folderId: item.folderId,
            isPersonal: item.isPersonal,
            mimeType: item.file.type,
          }),
          signal: abortController.signal,
        });

        if (!completeRes.ok) {
          const body = await completeRes.json().catch(() => ({}));
          throw new Error(body.error || `Complete failed (${completeRes.status})`);
        }

        item.status = "done";
        completedSinceLastInvalidate.current++;
        updateUpload(item.id, { progress: 100, status: "done", speed: undefined });
      } catch (err) {
        if (abortController.signal.aborted) {
          item.status = "cancelled";
          updateUpload(item.id, { status: "cancelled", error: "Cancelled", speed: undefined });
        } else {
          item.status = "error";
          const message = err instanceof Error ? err.message : "Upload failed";
          updateUpload(item.id, { status: "error", error: message, speed: undefined });
        }
      }
    },
    [updateUpload]
  );

  // ── Single-request upload via XHR (for small files, supports progress) ──
  const uploadSingle = useCallback(
    (item: UploadItem) => {
      const formData = new FormData();
      formData.append("file", item.file);
      if (item.folderId) formData.append("folderId", item.folderId);
      if (item.isPersonal) formData.append("isPersonal", "true");

      const xhr = new XMLHttpRequest();
      item._xhr = xhr;

      let lastLoaded = 0;
      let lastTime = Date.now();

      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        const percent = Math.round((e.loaded / e.total) * 100);
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;

        let speed: number | undefined;
        if (elapsed > 0.3) {
          speed = (e.loaded - lastLoaded) / elapsed;
          lastLoaded = e.loaded;
          lastTime = now;
        }

        updateUpload(item.id, {
          progress: percent,
          ...(speed !== undefined ? { speed } : {}),
        });
      });

      return new Promise<void>((resolve) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            item.status = "done";
            completedSinceLastInvalidate.current++;
            updateUpload(item.id, { progress: 100, status: "done", speed: undefined });
          } else {
            let errorMsg = "Upload failed";
            try {
              const body = JSON.parse(xhr.responseText);
              errorMsg = body.error || errorMsg;
            } catch { /* ignore */ }
            item.status = "error";
            updateUpload(item.id, {
              status: "error",
              error: `${errorMsg} (${xhr.status})`,
              speed: undefined,
            });
          }
          resolve();
        });

        xhr.addEventListener("error", () => {
          item.status = "error";
          updateUpload(item.id, {
            status: "error",
            error: "Network error — check your connection",
            speed: undefined,
          });
          resolve();
        });

        xhr.addEventListener("abort", () => {
          item.status = "cancelled";
          updateUpload(item.id, { status: "cancelled", error: "Cancelled", speed: undefined });
          resolve();
        });

        xhr.open("POST", "/api/files/upload");
        xhr.send(formData);
      });
    },
    [updateUpload]
  );

  const processNext = useCallback(() => {
    if (activeCount.current >= MAX_CONCURRENT) return;

    const next = queueRef.current.find((u) => u.status === "queued");
    if (!next) {
      if (completedSinceLastInvalidate.current > 0) {
        invalidateFiles();
      }
      return;
    }

    activeCount.current++;
    next.status = "uploading";
    next.startedAt = Date.now();
    updateUpload(next.id, { status: "uploading", startedAt: next.startedAt });

    const isLarge = next.file.size > CHUNK_THRESHOLD;

    const done = () => {
      activeCount.current--;
      processNext();
    };

    if (isLarge) {
      uploadChunked(next).then(done);
    } else {
      uploadSingle(next).then(done);
    }

    // Kick off more concurrent uploads
    processNext();
  }, [updateUpload, invalidateFiles, uploadChunked, uploadSingle]);

  const enqueueFiles = useCallback(
    (files: File[], folderId?: string | null, isPersonal?: boolean) => {
      if (files.length === 0) return;

      const newItems: UploadItem[] = files.map((f) => ({
        id: generateId(),
        file: f,
        folderId: folderId ?? null,
        isPersonal: isPersonal ?? false,
        progress: 0,
        status: "queued" as const,
      }));

      queueRef.current = [...queueRef.current, ...newItems];
      setUploads((prev) => [...prev, ...newItems]);
      processNext();
    },
    [processNext]
  );

  const retryUpload = useCallback(
    (id: string) => {
      const item = queueRef.current.find((u) => u.id === id);
      if (!item) return;

      item.status = "queued";
      item.progress = 0;
      item.error = undefined;
      item.speed = undefined;
      item._abort = undefined;
      item._xhr = undefined;

      updateUpload(id, {
        status: "queued",
        progress: 0,
        error: undefined,
        speed: undefined,
      });

      processNext();
    },
    [processNext, updateUpload]
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const item = queueRef.current.find((u) => u.id === id);
      if (!item) return;

      if (item.status === "uploading") {
        // Abort chunked upload
        if (item._abort) {
          item._abort.abort();
        }
        // Abort XHR upload
        if (item._xhr) {
          item._xhr.abort();
        }
      } else if (item.status === "queued") {
        item.status = "cancelled";
        updateUpload(id, { status: "cancelled", error: "Cancelled" });
      }
    },
    [updateUpload]
  );

  const removeUpload = useCallback((id: string) => {
    queueRef.current = queueRef.current.filter((u) => u.id !== id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    queueRef.current = queueRef.current.filter(
      (u) => u.status === "queued" || u.status === "uploading"
    );
    setUploads((prev) =>
      prev.filter((u) => u.status === "queued" || u.status === "uploading")
    );
  }, []);

  const retryAllFailed = useCallback(() => {
    queueRef.current.forEach((item) => {
      if (item.status === "error" || item.status === "cancelled") {
        item.status = "queued";
        item.progress = 0;
        item.error = undefined;
        item.speed = undefined;
        item._abort = undefined;
        item._xhr = undefined;
      }
    });
    setUploads((prev) =>
      prev.map((u) =>
        u.status === "error" || u.status === "cancelled"
          ? { ...u, status: "queued" as const, progress: 0, error: undefined, speed: undefined }
          : u
      )
    );
    processNext();
  }, [processNext]);

  return (
    <UploadContext.Provider
      value={{
        uploads,
        enqueueFiles,
        retryUpload,
        cancelUpload,
        removeUpload,
        clearCompleted,
        retryAllFailed,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}
