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
  xhr?: XMLHttpRequest;
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

  // Invalidate file queries once when batch completes (not per file)
  const invalidateFiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    completedSinceLastInvalidate.current = 0;
  }, [queryClient]);

  const processNext = useCallback(() => {
    if (activeCount.current >= MAX_CONCURRENT) return;

    const next = queueRef.current.find((u) => u.status === "queued");
    if (!next) {
      // All done — invalidate once if any succeeded
      if (completedSinceLastInvalidate.current > 0) {
        invalidateFiles();
      }
      return;
    }

    activeCount.current++;
    next.status = "uploading";
    next.startedAt = Date.now();

    const formData = new FormData();
    formData.append("file", next.file);
    if (next.folderId) formData.append("folderId", next.folderId);
    if (next.isPersonal) formData.append("isPersonal", "true");

    const xhr = new XMLHttpRequest();
    next.xhr = xhr;

    updateUpload(next.id, { status: "uploading", startedAt: next.startedAt });

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

      updateUpload(next.id, {
        progress: percent,
        ...(speed !== undefined ? { speed } : {}),
      });
    });

    xhr.addEventListener("load", () => {
      activeCount.current--;
      if (xhr.status >= 200 && xhr.status < 300) {
        next.status = "done";
        completedSinceLastInvalidate.current++;
        updateUpload(next.id, {
          progress: 100,
          status: "done",
          speed: undefined,
        });
      } else {
        let errorMsg = "Upload failed";
        try {
          const body = JSON.parse(xhr.responseText);
          errorMsg = body.error || errorMsg;
        } catch {
          /* ignore */
        }
        next.status = "error";
        updateUpload(next.id, {
          status: "error",
          error: `${errorMsg} (${xhr.status})`,
          speed: undefined,
        });
      }
      processNext();
    });

    xhr.addEventListener("error", () => {
      activeCount.current--;
      next.status = "error";
      updateUpload(next.id, {
        status: "error",
        error: "Network error — check your connection",
        speed: undefined,
      });
      processNext();
    });

    xhr.addEventListener("abort", () => {
      activeCount.current--;
      next.status = "cancelled";
      updateUpload(next.id, {
        status: "cancelled",
        error: "Cancelled",
        speed: undefined,
      });
      processNext();
    });

    xhr.open("POST", "/api/files/upload");
    xhr.send(formData);

    // Kick off more concurrent uploads
    processNext();
  }, [updateUpload, invalidateFiles]);

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
      item.xhr = undefined;

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
      if (item?.xhr && item.status === "uploading") {
        item.xhr.abort();
      } else if (item?.status === "queued") {
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
        item.xhr = undefined;
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
