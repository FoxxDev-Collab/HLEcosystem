import { useState } from "react"
import type { TripStatus } from "@/server/travel/trips"
import type {
  PackingCategory,
  ReservationType,
  TravelBudgetCategory,
  TravelCurrency,
} from "@/server/travel/detail"
import { formatDateShort } from "@/lib/format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

export const TRIP_STATUSES: Array<TripStatus> = [
  "PLANNING",
  "BOOKED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]

export const RESERVATION_TYPES: Array<ReservationType> = [
  "FLIGHT",
  "HOTEL",
  "CAR_RENTAL",
  "RESTAURANT",
  "ACTIVITY",
  "TRAIN",
  "BUS",
  "FERRY",
  "CRUISE",
  "OTHER",
]

export const TRANSPORT_TYPES: Array<ReservationType> = [
  "FLIGHT",
  "TRAIN",
  "BUS",
  "FERRY",
  "CRUISE",
]

export const CURRENCIES: Array<TravelCurrency> = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "MXN",
  "CHF",
  "OTHER",
]

export const PACKING_CATEGORIES: Array<PackingCategory> = [
  "CLOTHING",
  "TOILETRIES",
  "ELECTRONICS",
  "DOCUMENTS",
  "MEDICATIONS",
  "ACCESSORIES",
  "GEAR",
  "SNACKS",
  "OTHER",
]

export const BUDGET_CATEGORIES: Array<TravelBudgetCategory> = [
  "FLIGHTS",
  "ACCOMMODATION",
  "TRANSPORTATION",
  "FOOD_AND_DRINK",
  "ACTIVITIES",
  "SHOPPING",
  "INSURANCE",
  "VISA_AND_FEES",
  "COMMUNICATION",
  "OTHER",
]

export function statusVariant(
  status: TripStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "PLANNING":
      return "secondary"
    case "BOOKED":
    case "IN_PROGRESS":
      return "default"
    case "COMPLETED":
      return "outline"
    case "CANCELLED":
      return "destructive"
  }
}

/** "IN_PROGRESS" → "in progress" (rendered with capitalize). */
export function enumLabel(value: string): string {
  return value.replace(/_/g, " ").toLowerCase()
}

export function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string {
  if (!start || !end) return "—"
  return `${formatDateShort(start)} – ${formatDateShort(end)}`
}

/** "OTHER" is not an ISO code — Intl would throw on it. */
export function displayCurrency(currency: TravelCurrency): string {
  return currency === "OTHER" ? "USD" : currency
}

/** Parse an optional money <input type="number"> value to number | null. */
export function parseMoney(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim()
  if (!s) return null
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
  onDone,
}: {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => Promise<{ ok: true } | { error: string }>
  onClose: () => void
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await onConfirm()
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDone()
    } catch {
      setError("Something went wrong.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
