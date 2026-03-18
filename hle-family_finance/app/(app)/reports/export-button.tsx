"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportTransactionsCSV } from "./actions";

export function ExportButton({ year }: { year: number }) {
  async function handleExport() {
    const csv = await exportTransactionsCSV(year);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="size-4 mr-2" />
      Export CSV
    </Button>
  );
}
