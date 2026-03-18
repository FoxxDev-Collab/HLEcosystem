export function formatFileSize(bytes: number | bigint | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export function formatStorageUsage(used: number | bigint, total: number | bigint): string {
  return `${formatFileSize(used)} / ${formatFileSize(total)}`;
}

export function formatStoragePercent(used: number | bigint, total: number | bigint): number {
  const u = typeof used === "bigint" ? Number(used) : used;
  const t = typeof total === "bigint" ? Number(total) : total;
  if (t === 0) return 0;
  return Math.round((u / t) * 100);
}

export function formatMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/zip": "ZIP",
    "application/x-tar": "TAR",
    "application/gzip": "GZIP",
    "application/json": "JSON",
    "application/xml": "XML",
    "text/plain": "Text",
    "text/csv": "CSV",
    "text/html": "HTML",
    "text/markdown": "Markdown",
  };
  if (map[mimeType]) return map[mimeType];
  if (mimeType.startsWith("image/")) return mimeType.replace("image/", "").toUpperCase();
  if (mimeType.startsWith("video/")) return mimeType.replace("video/", "").toUpperCase();
  if (mimeType.startsWith("audio/")) return mimeType.replace("audio/", "").toUpperCase();
  return mimeType;
}
