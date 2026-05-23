import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { CurrentUser } from "@/lib/types";

export function Header({ user }: { user: CurrentUser }) {
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  async function triggerScan() {
    setScanning(true);
    setScanMsg(null);
    try {
      const run = await api<{ id: string; status: string }>(
        "/api/library/scan",
        { method: "POST" },
      );
      setScanMsg(`Scan started (${run.id.slice(0, 8)}…)`);
    } catch (err) {
      setScanMsg(err instanceof Error ? err.message : "scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <header className="border-b">
      <div className="container max-w-6xl mx-auto p-4 flex items-center justify-between gap-4">
        <a href="#" className="text-lg font-semibold">
          hle-media
        </a>
        <div className="flex items-center gap-3">
          {scanMsg && (
            <span className="text-xs text-muted-foreground">{scanMsg}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={scanning}
            onClick={triggerScan}
          >
            {scanning ? "Starting…" : "Scan"}
          </Button>
          <span className="text-xs text-muted-foreground">{user.name}</span>
        </div>
      </div>
    </header>
  );
}
