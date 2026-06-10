// Client-safe travel enums. See src/lib/finance-constants.ts for why these
// live outside the src/server/travel/* modules (which import "@/server/db").

export const TRAVEL_DOCUMENT_TYPES = [
  "PASSPORT",
  "VISA",
  "TRAVEL_INSURANCE",
  "DRIVERS_LICENSE",
  "VACCINATION_RECORD",
  "ITINERARY",
  "BOOKING_CONFIRMATION",
  "OTHER",
] as const

export type TravelDocumentType = (typeof TRAVEL_DOCUMENT_TYPES)[number]
