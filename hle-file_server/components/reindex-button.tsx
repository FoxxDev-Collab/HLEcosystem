"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

type State = "idle" | "running" | "done" | "error";

export function ReindexButton({ unindexedCount }: { unindexedCount: number }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setState("running");
    setMessage(null);
    try {
      const res = await fetch("/api/files/reindex", { method: "POST" });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Reindex failed");
      setMessage(data.message ?? "Done");
      setState("done");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reindex failed");
      setState("error");
    }
  };

  const isRunning = state === "running";

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isRunning || (state === "done" && unindexedCount === 0)}
      >
        <RefreshCw className={`size-4 mr-2 ${isRunning ? "animate-spin" : ""}`} />
        {isRunning ? "Indexing…" : "Re-index documents"}
      </Button>

      {message && (
        <span className={`text-sm flex items-center gap-1.5 ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {state === "done" && <CheckCircle2 className="size-4 text-green-500 shrink-0" />}
          {state === "error" && <AlertCircle className="size-4 text-destructive shrink-0" />}
          {message}
        </span>
      )}
    </div>
  );
}
