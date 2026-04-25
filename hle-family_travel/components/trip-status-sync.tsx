"use client";

import { useEffect } from "react";
import { syncTripStatusesAction } from "@/app/actions";

export function TripStatusSync() {
  useEffect(() => {
    syncTripStatusesAction().catch(() => {});
  }, []);
  return null;
}
