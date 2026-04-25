"use client";

import { useEffect } from "react";

// Fires a background sync request when the authenticated layout mounts.
// The sync API checks whether data is stale before doing any work, so
// repeated navigations within the 30-minute window are free (immediate 200).
export function MealieSyncTrigger() {
  useEffect(() => {
    fetch("/api/mealie/sync", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
