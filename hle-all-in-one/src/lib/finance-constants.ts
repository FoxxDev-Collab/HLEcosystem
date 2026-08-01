// Client-safe finance enums and display labels.
//
// These used to live in the src/server/finance/* modules, but those import
// "@/server/db" (which requires DATABASE_URL and Bun.sql at module load), so
// any route/component importing a runtime constant from them dragged the DB
// module into the browser bundle and crashed hydration. UI code imports the
// constants from here; the server modules re-export them so server-side
// imports (zod enums in fns.*) are unchanged.

export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "CASH"
  | "INVESTMENT"
  | "LOAN"
  | "HSA"
  | "OTHER"

export const ACCOUNT_TYPES: Array<AccountType> = [
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
  "CASH",
  "INVESTMENT",
  "LOAN",
  "HSA",
  "OTHER",
]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit Card",
  CASH: "Cash",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  HSA: "HSA",
  OTHER: "Other",
}

export type AssetType =
  | "REAL_ESTATE"
  | "VEHICLE"
  | "JEWELRY"
  | "ELECTRONICS"
  | "COLLECTIBLES"
  | "RETIREMENT"
  | "INVESTMENT"
  | "OTHER"

export const ASSET_TYPES: Array<AssetType> = [
  "REAL_ESTATE",
  "VEHICLE",
  "INVESTMENT",
  "RETIREMENT",
  "JEWELRY",
  "ELECTRONICS",
  "COLLECTIBLES",
  "OTHER",
]

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  REAL_ESTATE: "Real Estate",
  VEHICLE: "Vehicle",
  INVESTMENT: "Investment",
  RETIREMENT: "Retirement",
  JEWELRY: "Jewelry",
  ELECTRONICS: "Electronics",
  COLLECTIBLES: "Collectibles",
  OTHER: "Other",
}

export type TaxFilingStatus =
  | "SINGLE"
  | "MARRIED_FILING_JOINTLY"
  | "MARRIED_FILING_SEPARATELY"
  | "HEAD_OF_HOUSEHOLD"
  | "QUALIFYING_WIDOWER"

export const FILING_STATUSES: Array<TaxFilingStatus> = [
  "SINGLE",
  "MARRIED_FILING_JOINTLY",
  "MARRIED_FILING_SEPARATELY",
  "HEAD_OF_HOUSEHOLD",
  "QUALIFYING_WIDOWER",
]

export const FILING_STATUS_LABELS: Record<TaxFilingStatus, string> = {
  SINGLE: "Single",
  MARRIED_FILING_JOINTLY: "Married Filing Jointly",
  MARRIED_FILING_SEPARATELY: "Married Filing Separately",
  HEAD_OF_HOUSEHOLD: "Head of Household",
  QUALIFYING_WIDOWER: "Qualifying Widower",
}

export type TaxDocumentType =
  | "W2"
  | "FORM_1099_INT"
  | "FORM_1099_DIV"
  | "FORM_1099_NEC"
  | "FORM_1098"
  | "FORM_1099_B"
  | "FORM_1099_R"
  | "K1"
  | "FORM_1099_SA"
  | "FORM_5498_SA"
  | "OTHER"

export const TAX_DOCUMENT_TYPES: Array<TaxDocumentType> = [
  "W2",
  "FORM_1099_INT",
  "FORM_1099_DIV",
  "FORM_1099_NEC",
  "FORM_1098",
  "FORM_1099_B",
  "FORM_1099_R",
  "K1",
  "FORM_1099_SA",
  "FORM_5498_SA",
  "OTHER",
]

export const TAX_DOCUMENT_TYPE_LABELS: Record<TaxDocumentType, string> = {
  W2: "W-2",
  FORM_1099_INT: "1099-INT",
  FORM_1099_DIV: "1099-DIV",
  FORM_1099_NEC: "1099-NEC",
  FORM_1098: "1098",
  FORM_1099_B: "1099-B",
  FORM_1099_R: "1099-R",
  K1: "K-1",
  FORM_1099_SA: "1099-SA",
  FORM_5498_SA: "5498-SA",
  OTHER: "Other",
}

export type RecurrenceFrequency =
  "DAILY" | "WEEKLY" | "BI_WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"

export const RECURRENCE_FREQUENCIES: Array<{
  value: RecurrenceFrequency
  label: string
}> = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BI_WEEKLY", label: "Bi-Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
]

export type DebtType =
  | "MORTGAGE"
  | "AUTO_LOAN"
  | "STUDENT_LOAN"
  | "PERSONAL_LOAN"
  | "HELOC"
  | "CREDIT_CARD"
  | "MEDICAL_DEBT"
  | "OTHER"

export const DEBT_TYPES: Array<DebtType> = [
  "MORTGAGE",
  "AUTO_LOAN",
  "STUDENT_LOAN",
  "PERSONAL_LOAN",
  "HELOC",
  "CREDIT_CARD",
  "MEDICAL_DEBT",
  "OTHER",
]

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  MORTGAGE: "Mortgage",
  AUTO_LOAN: "Auto Loan",
  STUDENT_LOAN: "Student Loan",
  PERSONAL_LOAN: "Personal Loan",
  HELOC: "HELOC",
  CREDIT_CARD: "Credit Card",
  MEDICAL_DEBT: "Medical Debt",
  OTHER: "Other",
}

export type BudgetPlannerProjectStatus =
  "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED"

export const PROJECT_STATUSES: Array<BudgetPlannerProjectStatus> = [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]

export type FinanceTripStatus =
  "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED"

export const TRIP_STATUSES: Array<FinanceTripStatus> = [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]

export type FinanceTripExpenseType =
  "GAS" | "FOOD" | "LODGING" | "TRANSPORT" | "SUPPLIES" | "OTHER"

export const TRIP_EXPENSE_TYPES: Array<FinanceTripExpenseType> = [
  "GAS",
  "FOOD",
  "LODGING",
  "TRANSPORT",
  "SUPPLIES",
  "OTHER",
]

export const TRIP_EXPENSE_TYPE_LABELS: Record<FinanceTripExpenseType, string> =
  {
    GAS: "Gas",
    FOOD: "Food",
    LODGING: "Lodging",
    TRANSPORT: "Transport",
    SUPPLIES: "Supplies",
    OTHER: "Other",
  }

export type BillCategory =
  | "UTILITIES"
  | "INSURANCE"
  | "SUBSCRIPTIONS"
  | "PHONE"
  | "INTERNET"
  | "RENT"
  | "MORTGAGE"
  | "CAR_PAYMENT"
  | "CHILD_CARE"
  | "STREAMING"
  | "OTHER"

export const BILL_CATEGORIES: Array<BillCategory> = [
  "UTILITIES",
  "INSURANCE",
  "SUBSCRIPTIONS",
  "PHONE",
  "INTERNET",
  "RENT",
  "MORTGAGE",
  "CAR_PAYMENT",
  "CHILD_CARE",
  "STREAMING",
  "OTHER",
]
