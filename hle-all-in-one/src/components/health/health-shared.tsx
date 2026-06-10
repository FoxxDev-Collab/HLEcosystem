// Shared bits for the health module's workout + pet pages.

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

// Legacy lib/format.ts duration helpers (not in the shared @/lib/format).
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`
}

export function durationMinutes(
  startTime: Date | string,
  endTime: Date | string | null
): number | null {
  if (!endTime) return null
  return Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
  )
}

// FormData extraction helpers — empty inputs mean null.
export function formStr(f: FormData, key: string): string {
  return String(f.get(key) ?? "").trim()
}

export function formNumOrNull(f: FormData, key: string): number | null {
  const v = formStr(f, key)
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function formIntOrNull(f: FormData, key: string): number | null {
  const n = formNumOrNull(f, key)
  return n === null ? null : Math.trunc(n)
}

export const SPECIES_LABELS: Record<string, string> = {
  DOG: "Dog",
  CAT: "Cat",
  BIRD: "Bird",
  FISH: "Fish",
  REPTILE: "Reptile",
  SMALL_MAMMAL: "Small Mammal",
  HORSE: "Horse",
  OTHER: "Other",
}

export const SPECIES_OPTIONS = [
  "DOG",
  "CAT",
  "BIRD",
  "FISH",
  "REPTILE",
  "SMALL_MAMMAL",
  "HORSE",
  "OTHER",
] as const

// "YYYY-MM-DD" DATE strings compare lexicographically.
export function isDateOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date()
  const m = String(today.getMonth() + 1).padStart(2, "0")
  const d = String(today.getDate()).padStart(2, "0")
  return dateStr < `${today.getFullYear()}-${m}-${d}`
}
