// AI Smart Link (legacy transactions/smart-link/actions.ts): matches unlinked
// expense transactions to debts / bills / recurring rules, accepts links
// (DebtPayment / BillPayment / recurringTransactionId), learns
// TransactionLinkPattern rows for one-click auto-linking, and turns AI
// "discovered patterns" into new bills / recurring rules.
//
// Debt/bill row reads here are deliberately small LOCAL queries — Agent B
// owns the full debts/bills features; smart-link only needs picker-level
// fields (see docs/plans/finance-port.md, Agent C scope).
//
// SECURITY (ADR-0005): every client-supplied id (transaction, debt, bill,
// recurring, account) is re-verified against the caller's householdId before
// any mutation — including ids the legacy code forgot to scope (bill in
// acceptBillLinkAction, recurring in acceptRecurringLinkAction, accountId in
// createRecurringFromSuggestionAction).
import { sql } from "@/server/db"
import { smartLinkTransactions } from "./claude-api"
import type {
  SmartLinkMatch,
  SuggestedBill,
  SuggestedRecurring,
} from "./claude-api"

export type UnlinkedTransactionRow = {
  id: string
  payee: string | null
  description: string | null
  amount: number
  date: string
  accountId: string
  accountName: string
  type: string
}

// Minimal local row shapes (Agent B owns the full debts/bills modules).
type DebtLite = {
  id: string
  name: string
  type: string
  lender: string | null
  currentBalance: number
  interestRate: number
  minimumPayment: number | null
  paymentDayOfMonth: number | null
  isArchived: boolean
}

type BillLite = {
  id: string
  name: string
  payee: string | null
  category: string
  expectedAmount: number
  dueDayOfMonth: number
  isActive: boolean
}

type RecurringLite = {
  id: string
  name: string
  payee: string | null
  amount: number
  frequency: string
  type: string
}

// Expense transactions from the last 90 days with no debt/bill/recurring
// link (legacy query, expressed with NOT EXISTS).
export async function listUnlinkedTransactions(
  householdId: string
): Promise<Array<UnlinkedTransactionRow>> {
  return sql<Array<UnlinkedTransactionRow>>`
    SELECT t."id", t."payee", t."description", t."amount"::float8,
           t."date"::text, t."accountId", a."name" AS "accountName", t."type"
    FROM "Transaction" t
    JOIN "Account" a ON a."id" = t."accountId"
    WHERE t."householdId" = ${householdId}
      AND t."type" = 'EXPENSE'
      AND t."date" >= CURRENT_DATE - INTERVAL '90 days'
      AND t."recurringTransactionId" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "DebtPayment" dp
        WHERE dp."linkedTransactionId" = t."id")
      AND NOT EXISTS (
        SELECT 1 FROM "BillPayment" bp
        WHERE bp."linkedTransactionId" = t."id")
    ORDER BY t."date" DESC, t."createdAt" DESC
    LIMIT 100`
}

export async function countLinkPatterns(householdId: string): Promise<number> {
  const [row] = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "TransactionLinkPattern"
    WHERE "householdId" = ${householdId}`
  return row.count
}

async function getDebt(
  householdId: string,
  id: string
): Promise<DebtLite | null> {
  const [debt] = await sql<Array<DebtLite>>`
    SELECT "id", "name", "type", "lender", "currentBalance"::float8,
           "interestRate"::float8, "minimumPayment"::float8,
           "paymentDayOfMonth", "isArchived"
    FROM "Debt"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return debt ?? null
}

async function getBill(
  householdId: string,
  id: string
): Promise<BillLite | null> {
  const [bill] = await sql<Array<BillLite>>`
    SELECT "id", "name", "payee", "category", "expectedAmount"::float8,
           "dueDayOfMonth", "isActive"
    FROM "MonthlyBill"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return bill ?? null
}

async function getScopedTransaction(
  householdId: string,
  id: string
): Promise<{ id: string; date: string; amount: number } | null> {
  const [tx] = await sql<Array<{ id: string; date: string; amount: number }>>`
    SELECT "id", "date"::text, "amount"::float8
    FROM "Transaction"
    WHERE "id" = ${id} AND "householdId" = ${householdId}`
  return tx ?? null
}

// Bill due date in the same month as the payment (legacy Date rollover
// semantics for day-of-month > days-in-month are preserved).
function billDueDate(txDate: string, dueDayOfMonth: number): string {
  const [y, m] = txDate.split("-").map(Number)
  const due = new Date(y, m - 1, dueDayOfMonth)
  const yy = due.getFullYear()
  const mm = String(due.getMonth() + 1).padStart(2, "0")
  const dd = String(due.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

export type AnalyzeResult =
  | {
      matches: Array<SmartLinkMatch>
      suggestedBills: Array<SuggestedBill>
      suggestedRecurring: Array<SuggestedRecurring>
    }
  | { error: string }

// The gateway payload is built EXCLUSIVELY from householdId-scoped queries —
// no other household's data can reach the prompt.
export async function analyzeTransactions(
  householdId: string,
  transactionIds: Array<string>
): Promise<AnalyzeResult> {
  const limitedIds = transactionIds.slice(0, 50)
  if (limitedIds.length === 0) {
    return { matches: [], suggestedBills: [], suggestedRecurring: [] }
  }

  const [transactions, debts, bills, recurring] = await Promise.all([
    sql<
      Array<{
        id: string
        date: string
        amount: number
        payee: string | null
        description: string | null
        accountName: string
        categoryName: string | null
        type: string
      }>
    >`
      SELECT t."id", t."date"::text, t."amount"::float8, t."payee",
             t."description", a."name" AS "accountName",
             c."name" AS "categoryName", t."type"
      FROM "Transaction" t
      JOIN "Account" a ON a."id" = t."accountId"
      LEFT JOIN "Category" c ON c."id" = t."categoryId"
      WHERE t."id" IN ${sql(limitedIds)}
        AND t."householdId" = ${householdId}`,
    sql<Array<DebtLite>>`
      SELECT "id", "name", "type", "lender", "currentBalance"::float8,
             "interestRate"::float8, "minimumPayment"::float8,
             "paymentDayOfMonth", "isArchived"
      FROM "Debt"
      WHERE "householdId" = ${householdId} AND NOT "isArchived"`,
    sql<Array<BillLite>>`
      SELECT "id", "name", "payee", "category", "expectedAmount"::float8,
             "dueDayOfMonth", "isActive"
      FROM "MonthlyBill"
      WHERE "householdId" = ${householdId} AND "isActive"`,
    sql<Array<RecurringLite>>`
      SELECT "id", "name", "payee", "amount"::float8, "frequency", "type"
      FROM "RecurringTransaction"
      WHERE "householdId" = ${householdId} AND "isActive"`,
  ])

  const result = await smartLinkTransactions({
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      payee: t.payee,
      description: t.description,
      accountName: t.accountName,
      categoryName: t.categoryName,
      type: t.type,
    })),
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      lender: d.lender,
      currentBalance: d.currentBalance,
      interestRate: d.interestRate,
      minimumPayment: d.minimumPayment,
      paymentDayOfMonth: d.paymentDayOfMonth,
    })),
    bills: bills.map((b) => ({
      id: b.id,
      name: b.name,
      payee: b.payee,
      category: b.category,
      expectedAmount: b.expectedAmount,
      dueDayOfMonth: b.dueDayOfMonth,
    })),
    recurring: recurring.map((r) => ({
      id: r.id,
      name: r.name,
      payee: r.payee,
      amount: r.amount,
      frequency: r.frequency,
      type: r.type,
    })),
  })

  if (!result.success || !result.data) {
    return { error: result.error || "Analysis failed" }
  }

  return {
    matches: result.data.matches || [],
    suggestedBills: result.data.suggestedBills || [],
    suggestedRecurring: result.data.suggestedRecurring || [],
  }
}

// Learned payee → match association. Unique on (household, payeePattern,
// matchType); repeats bump usageCount.
async function savePattern(
  householdId: string,
  payeePattern: string,
  matchType: "debt" | "bill" | "recurring",
  matchId: string,
  matchName: string
): Promise<void> {
  const normalized = payeePattern.toLowerCase().trim()
  if (!normalized) return

  await sql`
    INSERT INTO "TransactionLinkPattern" (
      "householdId", "payeePattern", "matchType", "matchId", "matchName"
    ) VALUES (
      ${householdId}, ${normalized}, ${matchType}, ${matchId}, ${matchName}
    )
    ON CONFLICT ("householdId", "payeePattern", "matchType") DO UPDATE SET
      "matchId" = EXCLUDED."matchId",
      "matchName" = EXCLUDED."matchName",
      "usageCount" = "TransactionLinkPattern"."usageCount" + 1,
      "updatedAt" = now()`
}

export async function acceptDebtLink(
  householdId: string,
  input: {
    transactionId: string
    debtId: string
    totalAmount: number
    principalAmount: number
    interestAmount: number
    payeePattern: string | null
  }
): Promise<{ ok: true } | { error: string }> {
  const [transaction, debt] = await Promise.all([
    getScopedTransaction(householdId, input.transactionId),
    getDebt(householdId, input.debtId),
  ])
  if (!transaction) return { error: "Transaction not found" }
  if (!debt) return { error: "Debt not found" }

  const remainingBalance = debt.currentBalance - input.principalAmount

  await sql`
    INSERT INTO "DebtPayment" (
      "debtId", "paymentDate", "totalAmount", "principalAmount",
      "interestAmount", "remainingBalance", "linkedTransactionId"
    ) VALUES (
      ${debt.id}, ${transaction.date}, ${input.totalAmount},
      ${input.principalAmount}, ${input.interestAmount},
      ${remainingBalance}, ${transaction.id}
    )`
  await sql`
    UPDATE "Debt"
    SET "currentBalance" = ${remainingBalance}, "updatedAt" = now()
    WHERE "id" = ${debt.id} AND "householdId" = ${householdId}`

  if (input.payeePattern) {
    await savePattern(
      householdId,
      input.payeePattern,
      "debt",
      debt.id,
      debt.name
    )
  }
  return { ok: true }
}

export async function acceptBillLink(
  householdId: string,
  input: {
    transactionId: string
    billId: string
    amountPaid: number
    payeePattern: string | null
  }
): Promise<{ ok: true } | { error: string }> {
  const [transaction, bill] = await Promise.all([
    getScopedTransaction(householdId, input.transactionId),
    getBill(householdId, input.billId),
  ])
  if (!transaction) return { error: "Transaction not found" }
  if (!bill) return { error: "Bill not found" }

  await sql`
    INSERT INTO "BillPayment" (
      "monthlyBillId", "dueDate", "paidDate", "amountDue", "amountPaid",
      "status", "linkedTransactionId"
    ) VALUES (
      ${bill.id}, ${billDueDate(transaction.date, bill.dueDayOfMonth)},
      ${transaction.date}, ${bill.expectedAmount}, ${input.amountPaid},
      'PAID', ${transaction.id}
    )`

  if (input.payeePattern) {
    await savePattern(
      householdId,
      input.payeePattern,
      "bill",
      bill.id,
      bill.name
    )
  }
  return { ok: true }
}

export async function acceptRecurringLink(
  householdId: string,
  input: {
    transactionId: string
    recurringId: string
    payeePattern: string | null
  }
): Promise<{ ok: true } | { error: string }> {
  const transaction = await getScopedTransaction(
    householdId,
    input.transactionId
  )
  if (!transaction) return { error: "Transaction not found" }

  // Scope the recurring rule too — the legacy code skipped this check.
  const [rec] = await sql<Array<{ id: string; name: string }>>`
    SELECT "id", "name" FROM "RecurringTransaction"
    WHERE "id" = ${input.recurringId} AND "householdId" = ${householdId}`
  if (!rec) return { error: "Recurring transaction not found" }

  await sql`
    UPDATE "Transaction"
    SET "recurringTransactionId" = ${rec.id}, "updatedAt" = now()
    WHERE "id" = ${transaction.id} AND "householdId" = ${householdId}`

  if (input.payeePattern) {
    await savePattern(
      householdId,
      input.payeePattern,
      "recurring",
      rec.id,
      rec.name
    )
  }
  return { ok: true }
}

export async function createBillFromSuggestion(
  householdId: string,
  input: {
    name: string
    payee: string
    category: string
    expectedAmount: number
    dueDayOfMonth: number
    transactionIds: Array<string>
  }
): Promise<{ ok: true; billId: string } | { error: string }> {
  const [bill] = await sql<Array<{ id: string }>>`
    INSERT INTO "MonthlyBill" (
      "householdId", "name", "payee", "category", "expectedAmount",
      "dueDayOfMonth"
    ) VALUES (
      ${householdId}, ${input.name}, ${input.payee},
      ${input.category}::"BillCategory", ${input.expectedAmount},
      ${input.dueDayOfMonth}
    )
    RETURNING "id"`

  // Link the matched transactions as paid bill payments (scoped lookups; a
  // foreign id is silently skipped — legacy behavior).
  for (const txId of input.transactionIds) {
    const tx = await getScopedTransaction(householdId, txId)
    if (!tx) continue
    await sql`
      INSERT INTO "BillPayment" (
        "monthlyBillId", "dueDate", "paidDate", "amountDue", "amountPaid",
        "status", "linkedTransactionId"
      ) VALUES (
        ${bill.id}, ${billDueDate(tx.date, input.dueDayOfMonth)}, ${tx.date},
        ${input.expectedAmount}, ${Math.abs(tx.amount)}, 'PAID', ${tx.id}
      )`
  }

  const normalized = input.payee.toLowerCase().trim()
  if (normalized) {
    await savePattern(householdId, normalized, "bill", bill.id, input.name)
  }
  return { ok: true, billId: bill.id }
}

export async function createRecurringFromSuggestion(
  householdId: string,
  input: {
    name: string
    payee: string
    amount: number
    frequency: string
    accountId: string
    transactionIds: Array<string>
  }
): Promise<{ ok: true; recurringId: string } | { error: string }> {
  // Scope the account — the legacy code trusted the client-picked accountId.
  const [account] = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Account"
    WHERE "id" = ${input.accountId} AND "householdId" = ${householdId}`
  if (!account) return { error: "Account not found" }

  const [rec] = await sql<Array<{ id: string }>>`
    INSERT INTO "RecurringTransaction" (
      "householdId", "accountId", "name", "payee", "type", "amount",
      "frequency", "startDate", "isActive"
    ) VALUES (
      ${householdId}, ${account.id}, ${input.name}, ${input.payee}, 'EXPENSE',
      ${input.amount}, ${input.frequency}::"RecurrenceFrequency",
      CURRENT_DATE, true
    )
    RETURNING "id"`

  for (const txId of input.transactionIds) {
    await sql`
      UPDATE "Transaction"
      SET "recurringTransactionId" = ${rec.id}, "updatedAt" = now()
      WHERE "id" = ${txId} AND "householdId" = ${householdId}`
  }

  const normalized = input.payee.toLowerCase().trim()
  if (normalized) {
    await savePattern(householdId, normalized, "recurring", rec.id, input.name)
  }
  return { ok: true, recurringId: rec.id }
}

// One-click auto-link: apply every saved pattern to the household's unlinked
// expense transactions from the last 90 days. Only the first matching
// pattern is applied per transaction (legacy behavior).
export async function autoLinkTransactions(
  householdId: string
): Promise<{ linked: number }> {
  const patterns = await sql<
    Array<{
      payeePattern: string
      matchType: string
      matchId: string
    }>
  >`
    SELECT "payeePattern", "matchType", "matchId"
    FROM "TransactionLinkPattern"
    WHERE "householdId" = ${householdId}
    ORDER BY "usageCount" DESC`
  if (patterns.length === 0) return { linked: 0 }

  const unlinked = await listUnlinkedTransactions(householdId)
  let linked = 0

  for (const tx of unlinked) {
    const payeeNorm = (tx.payee || tx.description || "").toLowerCase().trim()
    if (!payeeNorm) continue

    for (const pattern of patterns) {
      const isMatch =
        payeeNorm.includes(pattern.payeePattern) ||
        pattern.payeePattern.includes(payeeNorm)
      if (!isMatch) continue

      if (pattern.matchType === "debt") {
        const debt = await getDebt(householdId, pattern.matchId)
        if (!debt || debt.isArchived) continue

        // Estimate the principal/interest split from one month of interest
        // at the debt's current balance (legacy heuristic).
        const amount = Math.abs(tx.amount)
        const monthlyInterest = debt.currentBalance * (debt.interestRate / 12)
        const principal = Math.max(0, amount - monthlyInterest)
        const interest = amount - principal
        const remainingBalance = debt.currentBalance - principal

        await sql`
          INSERT INTO "DebtPayment" (
            "debtId", "paymentDate", "totalAmount", "principalAmount",
            "interestAmount", "remainingBalance", "linkedTransactionId"
          ) VALUES (
            ${debt.id}, ${tx.date}, ${amount}, ${principal}, ${interest},
            ${remainingBalance}, ${tx.id}
          )`
        await sql`
          UPDATE "Debt"
          SET "currentBalance" = ${remainingBalance}, "updatedAt" = now()
          WHERE "id" = ${debt.id} AND "householdId" = ${householdId}`
        linked++
      } else if (pattern.matchType === "bill") {
        const bill = await getBill(householdId, pattern.matchId)
        if (!bill || !bill.isActive) continue

        await sql`
          INSERT INTO "BillPayment" (
            "monthlyBillId", "dueDate", "paidDate", "amountDue", "amountPaid",
            "status", "linkedTransactionId"
          ) VALUES (
            ${bill.id}, ${billDueDate(tx.date, bill.dueDayOfMonth)},
            ${tx.date}, ${bill.expectedAmount}, ${Math.abs(tx.amount)},
            'PAID', ${tx.id}
          )`
        linked++
      } else if (pattern.matchType === "recurring") {
        const [rec] = await sql<Array<{ id: string }>>`
          SELECT "id" FROM "RecurringTransaction"
          WHERE "id" = ${pattern.matchId} AND "householdId" = ${householdId}`
        if (!rec) continue

        await sql`
          UPDATE "Transaction"
          SET "recurringTransactionId" = ${rec.id}, "updatedAt" = now()
          WHERE "id" = ${tx.id} AND "householdId" = ${householdId}`
        linked++
      } else {
        continue
      }
      break // Only one match per transaction.
    }
  }

  return { linked }
}
