// Shared date/currency formatters (ported from the legacy apps' lib/format.ts).
// Always format through these — never inline Intl calls in components.

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "USD",
): string {
  if (amount === null || amount === undefined) return ""
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return ""
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

function toDate(date: Date | string): Date {
  if (date instanceof Date) return date
  // Bare DATE columns arrive as "YYYY-MM-DD"; parse as local time, not UTC,
  // so the rendered day doesn't shift in western timezones.
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(date)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(toDate(date))
}

export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return ""
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(toDate(date))
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(toDate(date))
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(date))
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatAge(
  dateOfBirth: Date | string | null | undefined,
): number | null {
  if (!dateOfBirth) return null
  const dob = toDate(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

/** Input value for <input type="date"> from a DATE string or Date. */
export function toDateInputValue(
  date: Date | string | null | undefined,
): string {
  if (!date) return ""
  if (typeof date === "string") return date.slice(0, 10)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
