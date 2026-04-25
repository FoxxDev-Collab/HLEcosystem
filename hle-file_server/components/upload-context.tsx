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

const MAX_CONCURRENT = 3;           // files uploading simultaneously
const CHUNK_THRESHOLD = 10 * 1024 * 1024;  // files above this use chunked upload
const CHUNK_SIZE = 5 * 1024 * 1024;        // 5 MB per chunk
const CONCURRENT_CHUNKS = 4;        // parallel chunk requests per file
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Parallel chunk upload — runs CONCURRENT_CHUNKS workers simultaneously.
// Each worker claims the next unstarted chunk index via a shared cursor.
// The cursor increment is synchronous (before any await), so there are no
// races despite the workers running concurrently as async functions.
// The server writes each chunk to its own file (chunk_000000, chunk_000001…)
// and assembles them in order, so arrival order does not matter.
// ---------------------------------------------------------------------------
async function uploadChunksParallel(
  file: File,
  uploadId: string,
  signal: AbortSignal,
  onChunkDone: (cumulativeBytes: number) => void
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let cursor = 0;
  let uploadedBytes = 0;

  const worker = async (): Promise<void> => {
    while (cursor < totalChunks) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const i = cursor++; // claim this index before the first await
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        try {
          const res = await fetch("/api/files/upload/chunked", {
            method: "PUT",
            headers: {
              "x-upload-id": uploadId,
              "x-chunk-index": String(i),
            },
            body: file.slice(start, end),
            signal,
          });
          if (res.ok) break;
          if (attempt === MAX_RETRIES) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? `Chunk ${i} failed (${res.status})`);
          }
        } catch (err) {
          if (signal.aborted) throw err;
          if (attempt === MAX_RETRIES) throw err;
          await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
        }
      }

      uploadedBytes += end - start;
      onChunkDone(uploadedBytes);
    }
  };

  const concurrency = Math.min(CONCURRENT_CHUNKS, totalChunks);
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ---------------------------------------------------------------------------
// UploadProvider
// ---------------------------------------------------------------------------
export function UploadProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const activeCount = useRef(0);
  const queueRef = useRef<UploadItem[]>([]);

  // ── Batched rAF updates ────────────────────────────────────────────────
  // Progress events arrive many times per second per file. Collecting all
  // patches for a single requestAnimationFrame and flushing them in one
  // setUploads call keeps the render rate at ~60fps regardless of upload
  // speed or number of concurrent files.
  const pendingPatches = useRef<Map<string, Partial<UploadItem>>>(new Map());
  const rafPending = useRef(false);

  const flushPatches = useCallback(() => {
    rafPending.current = false;
    const patches = new Map(pendingPatches.current);
    pendingPatches.current.clear();
    setUploads((prev) =>
      prev.map((u) => {
        const patch = patches.get(u.id);
        return patch ? { ...u, ...patch } : u;
      })
    );
  }, []);

  // For progress-only updates (many per second) — deferred to next frame.
  const scheduleUpdate = useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      pendingPatches.current.set(id, {
        ...pendingPatches.current.get(id),
        ...patch,
      });
      if (!rafPending.current) {
        rafPending.current = true;
        requestAnimationFrame(flushPatches);
      }
    },
    [flushPatches]
  );

  // For status transitions (queued→uploading, uploading→done/error/cancelled)
  // — applied immediately so the UI responds without waiting for the next frame.
  const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  // ── Debounced invalidation ─────────────────────────────────────────────
  // Called per-completion so files appear in the browser shortly after they
  // land. Debounced to avoid N sequential React Query refetches when N files
  // finish in a burst.
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidateFiles = useCallback(() => {
    if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
    invalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      invalidateTimer.current = null;
    }, 400);
  }, [queryClient]);

  // ── Chunked upload ─────────────────────────────────────────────────────
  const uploadChunked = useCallback(
    async (item: UploadItem) => {
      const abort = new AbortController();
      item._abort = abort;
      updateUpload(item.id, { _abort: abort });

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
          signal: abort.signal,
        });
        if (!initRes.ok) {
          const body = await initRes.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Init failed (${initRes.status})`);
        }
        const { uploadId } = (await initRes.json()) as { uploadId: string };

        // 2. Upload all chunks in parallel
        let lastSpeedBytes = 0;
        let lastSpeedTime = Date.now();

        await uploadChunksParallel(
          item.file,
          uploadId,
          abort.signal,
          (cumulativeBytes) => {
            const progress = Math.round((cumulativeBytes / item.file.size) * 100);
            const now = Date.now();
            const elapsed = (now - lastSpeedTime) / 1000;
            let speed: number | undefined;
            if (elapsed >= 0.5) {
              speed = (cumulativeBytes - lastSpeedBytes) / elapsed;
              lastSpeedBytes = cumulativeBytes;
              lastSpeedTime = now;
            }
            scheduleUpdate(item.id, { progress, ...(speed !== undefined ? { speed } : {}) });
          }
        );

        // 3. Complete — assemble chunks on server, create DB record
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
          signal: abort.signal,
        });
        if (!completeRes.ok) {
          const body = await completeRes.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Complete failed (${completeRes.status})`);
        }

        item.status = "done";
        updateUpload(item.id, { progress: 100, status: "done", speed: undefined });
        invalidateFiles();
      } catch (err) {
        if (abort.signal.aborted) {
          item.status = "cancelled";
          updateUpload(item.id, { status: "cancelled", error: "Cancelled", speed: undefined });
          // Inform server so it can clean up chunk directory
          fetch("/api/files/upload/chunked", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "abort", uploadId: item._abort }),
          }).catch(() => {});
        } else {
          item.status = "error";
          updateUpload(item.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
            speed: undefined,
          });
        }
      }
    },
    [updateUpload, scheduleUpdate, invalidateFiles]
  );

  // ── Single-request XHR upload (small files, real-time progress) ────────
  const uploadSingle = useCallback(
    (item: UploadItem, attempt = 0): Promise<void> => {
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
        scheduleUpdate(item.id, { progress: percent, ...(speed !== undefined ? { speed } : {}) });
      });

      return new Promise<void>((resolve) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            item.status = "done";
            updateUpload(item.id, { progress: 100, status: "done", speed: undefined });
            invalidateFiles();
            resolve();
          } else if (xhr.status >= 500 && attempt < MAX_RETRIES) {
            scheduleUpdate(item.id, { progress: 0, speed: undefined });
            setTimeout(
              () => uploadSingle(item, attempt + 1).then(resolve),
              RETRY_DELAY_MS * Math.pow(2, attempt)
            );
          } else {
            let errorMsg = "Upload failed";
            try {
              errorMsg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? errorMsg;
            } catch { /* ignore */ }
            item.status = "error";
            updateUpload(item.id, { status: "error", error: `${errorMsg} (${xhr.status})`, speed: undefined });
            resolve();
          }
        });

        xhr.addEventListener("error", () => {
          if (attempt < MAX_RETRIES) {
            scheduleUpdate(item.id, { progress: 0, speed: undefined });
            setTimeout(
              () => uploadSingle(item, attempt + 1).then(resolve),
              RETRY_DELAY_MS * Math.pow(2, attempt)
            );
          } else {
            item.status = "error";
            updateUpload(item.id, { status: "error", error: "Network error — check your connection", speed: undefined });
            resolve();
          }
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
    [updateUpload, scheduleUpdate, invalidateFiles]
  );

  // ── Queue processor ────────────────────────────────────────────────────
  // Stored in a ref so that onDone closures from in-flight uploads always
  // call the current version, preventing the stale-closure problem where
  // an upload started before a re-render completes calling an old processNext
  // that references replaced uploadChunked/uploadSingle functions.
  const processNextRef = useRef<() => void>(() => {});

  const processNext = useCallback(() => {
    while (activeCount.current < MAX_CONCURRENT) {
      const next = queueRef.current.find((u) => u.status === "queued");
      if (!next) break;

      activeCount.current++;
      next.status = "uploading";
      next.startedAt = Date.now();
      updateUpload(next.id, { status: "uploading", startedAt: next.startedAt });

      const onDone = () => {
        activeCount.current--;
        processNextRef.current();
      };

      if (next.file.size > CHUNK_THRESHOLD) {
        uploadChunked(next).then(onDone);
      } else {
        uploadSingle(next).then(onDone);
      }
    }
  }, [updateUpload, uploadChunked, uploadSingle]);

  processNextRef.current = processNext;

  // ── Public API ─────────────────────────────────────────────────────────
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
      updateUpload(id, { status: "queued", progress: 0, error: undefined, speed: undefined });
      processNext();
    },
    [processNext, updateUpload]
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const item = queueRef.current.find((u) => u.id === id);
      if (!item) return;
      if (item.status === "uploading") {
        item._abort?.abort();
        item._xhr?.abort();
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
      value={{ uploads, enqueueFiles, retryUpload, cancelUpload, removeUpload, clearCompleted, retryAllFailed }}
    >
      {children}
    </UploadContext.Provider>
  );
}
