// Finance dashboard aggregates (legacy dashboard/page.tsx). Reads Asset,
// Debt, and MonthlyBill directly even though their UIs belong to other
// feature files — same read-only approach as src/server/health/dashboard.ts.
// Balance-adjustment transactions are excluded from income/expense sums.
import { sql } from "@/server/db"
import type { AccountType } from "./accounts"
import type { TransactionType } from "./transactions"

export type DashboardAccountRow = {
  id: string
  name: string
  type: AccountType
  institution: string | null
  color: string | null
  currentBalance: number
}

export type DashboardTransactionRow = {
  id: string
  type: TransactionType
  amount: number
  date: string
  payee: string | null
  description: string | null
  accountName: string
  categoryName: string | null
}

export type DashboardBillRow = {
  id: string
  name: string
  expectedAmount: number
  dueDayOfMonth: number
  isPaid: boolean
}

export type MonthlyFlows = {
  monthIncome: number
  monthExpenses: number
  prevIncome: number
  prevExpenses: number
}

export type NetWorthTotals = {
  totalAssetValue: number
  assetCount: number
  totalDebtAmount: number
  debtCount: number
}

export type SpendingByCategory = {
  name: string
  color: string | null
  amount: number
}

export async function listDashboardAccounts(
  householdId: string
): Promise<Array<DashboardAccountRow>> {
  return sql<Array<DashboardAccountRow>>`
    SELECT "id", "name", "type", "institution", "color",
           "currentBalance"::float8
    FROM "Account"
    WHERE "householdId" = ${householdId} AND NOT "isArchived"
    ORDER BY "sortOrder" ASC, "name" ASC`
}

// Current-month and previous-month income/expense totals in one pass.
export async function getMonthlyFlows(
  householdId: string
): Promise<MonthlyFlows> {
  const [row] = await sql<Array<MonthlyFlows>>`
    SELECT
      COALESCE(SUM("amount") FILTER (
        WHERE "type" = 'INCOME'
          AND "date" >= date_trunc('month', CURRENT_DATE)), 0)::float8
        AS "monthIncome",
      COALESCE(SUM("amount") FILTER (
        WHERE "type" = 'EXPENSE'
          AND "date" >= date_trunc('month', CURRENT_DATE)), 0)::float8
        AS "monthExpenses",
      COALESCE(SUM("amount") FILTER (
        WHERE "type" = 'INCOME'
          AND "date" < date_trunc('month', CURRENT_DATE)), 0)::float8
        AS "prevIncome",
      COALESCE(SUM("amount") FILTER (
        WHERE "type" = 'EXPENSE'
          AND "date" < date_trunc('month', CURRENT_DATE)), 0)::float8
        AS "prevExpenses"
    FROM "Transaction"
    WHERE "householdId" = ${householdId}
      AND NOT "isBalanceAdjustment"
      AND "date" >= date_trunc('month', CURRENT_DATE) - interval '1 month'
      AND "date" < date_trunc('month', CURRENT_DATE) + interval '1 month'`
  return row
}

export async function listRecentTransactions(
  householdId: string
): Promise<Array<DashboardTransactionRow>> {
  return sql<Array<DashboardTransactionRow>>`
    SELECT t."id", t."type", t."amount"::float8, t."date"::text, t."payee",
           t."description", a."name" AS "accountName",
           c."name" AS "categoryName"
    FROM "Transaction" t
    JOIN "Account" a ON a."id" = t."accountId"
    LEFT JOIN "Category" c ON c."id" = t."categoryId"
    WHERE t."householdId" = ${householdId}
    ORDER BY t."date" DESC, t."createdAt" DESC
    LIMIT 8`
}

// Active bills with a "has a payment row this month" flag (legacy semantics).
export async function listUpcomingBills(
  householdId: string
): Promise<Array<DashboardBillRow>> {
  return sql<Array<DashboardBillRow>>`
    SELECT b."id", b."name", b."expectedAmount"::float8, b."dueDayOfMonth",
           EXISTS (
             SELECT 1 FROM "BillPayment" p
             WHERE p."monthlyBillId" = b."id"
               AND p."dueDate" >= date_trunc('month', CURRENT_DATE)
               AND p."dueDate" < date_trunc('month', CURRENT_DATE) + interval '1 month'
           ) AS "isPaid"
    FROM "MonthlyBill" b
    WHERE b."householdId" = ${householdId} AND b."isActive"
    ORDER BY b."dueDayOfMonth" ASC
    LIMIT 5`
}

// Net worth components. Matches legacy aggregation scope: active accounts,
// non-archived debts, all assets.
export async function getNetWorthTotals(
  householdId: string
): Promise<NetWorthTotals> {
  const [row] = await sql<Array<NetWorthTotals>>`
    SELECT
      (SELECT COALESCE(SUM("currentValue"), 0)::float8 FROM "Asset"
        WHERE "householdId" = ${householdId}) AS "totalAssetValue",
      (SELECT count(*)::int FROM "Asset"
        WHERE "householdId" = ${householdId}) AS "assetCount",
      (SELECT COALESCE(SUM("currentBalance"), 0)::float8 FROM "Debt"
        WHERE "householdId" = ${householdId} AND NOT "isArchived")
        AS "totalDebtAmount",
      (SELECT count(*)::int FROM "Debt"
        WHERE "householdId" = ${householdId} AND NOT "isArchived")
        AS "debtCount"`
  return row
}

// Top 5 spending categories this month, for the spending breakdown bars.
export async function getTopSpendingCategories(
  householdId: string
): Promise<Array<SpendingByCategory>> {
  return sql<Array<SpendingByCategory>>`
    SELECT c."name", c."color", SUM(t."amount")::float8 AS "amount"
    FROM "Transaction" t
    JOIN "Category" c ON c."id" = t."categoryId"
    WHERE t."householdId" = ${householdId}
      AND t."type" = 'EXPENSE'
      AND NOT t."isBalanceAdjustment"
      AND t."date" >= date_trunc('month', CURRENT_DATE)
      AND t."date" < date_trunc('month', CURRENT_DATE) + interval '1 month'
    GROUP BY c."id", c."name", c."color"
    ORDER BY SUM(t."amount") DESC
    LIMIT 5`
}
