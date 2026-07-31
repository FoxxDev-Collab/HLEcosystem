// Media-specific display helpers, ported from hle-media/src/lib/format.ts.
// (Dates/currency still go through @/lib/format — these are library-only.)

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return ""
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/**
 * Resolve a poster path to a URL. TMDB returns relative paths like
 * `/abc.jpg` which we expand to a full image URL. Anything that already
 * looks like a full URL is returned as-is.
 */
export function posterUrl(p: string | null): string | null {
  if (!p) return null
  if (p.startsWith("http://") || p.startsWith("https://")) return p
  return `https://image.tmdb.org/t/p/w500${p}`
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return ""
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}
