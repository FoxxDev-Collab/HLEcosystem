"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { smartLinkTransactions, type SmartLinkMatch } from "@/lib/claude-api";

export type AnalyzeResult = {
  matches: SmartLinkMatch[];
} | { error: string };

export async function analyzeTransactionsAction(
  transactionIds: string[]
): Promise<AnalyzeResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household" };

  const limitedIds = transactionIds.slice(0, 50);

  const [transactions, debts, bills, recurring] = await Promise.all([
    prisma.transaction.findMany({
      where: { id: { in: limitedIds }, householdId },
      include: { account: { select: { name: true } }, category: { select: { name: true } } },
    }),
    prisma.debt.findMany({
      where: { householdId, isArchived: false },
    }),
    prisma.monthlyBill.findMany({
      where: { householdId, isActive: true },
    }),
    prisma.recurringTransaction.findMany({
      where: { householdId, isActive: true },
    }),
  ]);

  const result = await smartLinkTransactions({
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString().split("T")[0],
      amount: Number(t.amount),
      payee: t.payee,
      description: t.description,
      accountName: t.account.name,
      categoryName: t.category?.name || null,
      type: t.type,
    })),
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      lender: d.lender,
      currentBalance: Number(d.currentBalance),
      interestRate: Number(d.interestRate),
      minimumPayment: d.minimumPayment ? Number(d.minimumPayment) : null,
      paymentDayOfMonth: d.paymentDayOfMonth,
    })),
    bills: bills.map((b) => ({
      id: b.id,
      name: b.name,
      payee: b.payee,
      category: b.category,
      expectedAmount: Number(b.expectedAmount),
      dueDayOfMonth: b.dueDayOfMonth,
    })),
    recurring: recurring.map((r) => ({
      id: r.id,
      name: r.name,
      payee: r.payee,
      amount: Number(r.amount),
      frequency: r.frequency,
      type: r.type,
    })),
  });

  if (!result.success || !result.data) {
    return { error: result.error || "Analysis failed" };
  }

  return { matches: result.data.matches };
}

export async function acceptDebtLinkAction(
  transactionId: string,
  debtId: string,
  totalAmount: number,
  principalAmount: number,
  interestAmount: number,
  payeePattern: string | null
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household" };

  const [transaction, debt] = await Promise.all([
    prisma.transaction.findUnique({ where: { id: transactionId } }),
    prisma.debt.findUnique({ where: { id: debtId } }),
  ]);

  if (!transaction || transaction.householdId !== householdId) return { error: "Transaction not found" };
  if (!debt || debt.householdId !== householdId) return { error: "Debt not found" };

  const remainingBalance = Number(debt.currentBalance) - principalAmount;

  await prisma.debtPayment.create({
    data: {
      debtId,
      paymentDate: transaction.date,
      totalAmount,
      principalAmount,
      interestAmount,
      remainingBalance,
      linkedTransactionId: transactionId,
    },
  });

  await prisma.debt.update({
    where: { id: debtId },
    data: { currentBalance: remainingBalance },
  });

  // Save pattern for auto-mapping
  if (payeePattern) {
    await savePattern(householdId, payeePattern, "debt", debtId, debt.name);
  }

  revalidatePath("/debts");
  revalidatePath(`/debts/${debtId}`);
  revalidatePath("/transactions/smart-link");
  return {};
}

export async function acceptBillLinkAction(
  transactionId: string,
  billId: string,
  amountPaid: number,
  payeePattern: string | null
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household" };

  const [transaction, bill] = await Promise.all([
    prisma.transaction.findUnique({ where: { id: transactionId } }),
    prisma.monthlyBill.findUnique({ where: { id: billId } }),
  ]);

  if (!transaction || transaction.householdId !== householdId) return { error: "Transaction not found" };
  if (!bill) return { error: "Bill not found" };

  const txDate = new Date(transaction.date);
  const dueDate = new Date(txDate.getFullYear(), txDate.getMonth(), bill.dueDayOfMonth);

  await prisma.billPayment.create({
    data: {
      monthlyBillId: billId,
      dueDate,
      paidDate: transaction.date,
      amountDue: bill.expectedAmount,
      amountPaid,
      status: "PAID",
      linkedTransactionId: transactionId,
    },
  });

  if (payeePattern) {
    await savePattern(householdId, payeePattern, "bill", billId, bill.name);
  }

  revalidatePath("/bills");
  revalidatePath("/transactions/smart-link");
  return {};
}

export async function acceptRecurringLinkAction(
  transactionId: string,
  recurringId: string,
  payeePattern: string | null
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household" };

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction || transaction.householdId !== householdId) return { error: "Transaction not found" };

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { recurringTransactionId: recurringId },
  });

  const rec = await prisma.recurringTransaction.findUnique({ where: { id: recurringId } });
  if (payeePattern && rec) {
    await savePattern(householdId, payeePattern, "recurring", recurringId, rec.name);
  }

  revalidatePath("/recurring");
  revalidatePath("/transactions/smart-link");
  return {};
}

async function savePattern(
  householdId: string,
  payeePattern: string,
  matchType: string,
  matchId: string,
  matchName: string
): Promise<void> {
  const normalized = payeePattern.toLowerCase().trim();
  if (!normalized) return;

  await prisma.transactionLinkPattern.upsert({
    where: {
      householdId_payeePattern_matchType: {
        householdId,
        payeePattern: normalized,
        matchType,
      },
    },
    update: {
      matchId,
      matchName,
      usageCount: { increment: 1 },
    },
    create: {
      householdId,
      payeePattern: normalized,
      matchType,
      matchId,
      matchName,
    },
  });
}

// Auto-apply saved patterns to new/imported transactions
export async function autoLinkTransactionsAction(): Promise<{ linked: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { linked: 0, error: "Not authenticated" };
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { linked: 0, error: "No household" };

  const patterns = await prisma.transactionLinkPattern.findMany({
    where: { householdId },
  });

  if (patterns.length === 0) return { linked: 0 };

  // Find unlinked expense transactions from last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const unlinked = await prisma.transaction.findMany({
    where: {
      householdId,
      type: "EXPENSE",
      date: { gte: ninetyDaysAgo },
      linkedDebtPayments: { none: {} },
      linkedBillPayments: { none: {} },
      recurringTransactionId: null,
    },
    select: { id: true, payee: true, description: true, amount: true, date: true },
  });

  let linked = 0;

  for (const tx of unlinked) {
    const payeeNorm = (tx.payee || tx.description || "").toLowerCase().trim();
    if (!payeeNorm) continue;

    for (const pattern of patterns) {
      if (payeeNorm.includes(pattern.payeePattern) || pattern.payeePattern.includes(payeeNorm)) {
        try {
          if (pattern.matchType === "debt") {
            const debt = await prisma.debt.findUnique({ where: { id: pattern.matchId } });
            if (!debt || debt.isArchived) continue;

            const amount = Math.abs(Number(tx.amount));
            const monthlyInterest = Number(debt.currentBalance) * (Number(debt.interestRate) / 12);
            const principal = Math.max(0, amount - monthlyInterest);
            const interest = amount - principal;
            const remainingBalance = Number(debt.currentBalance) - principal;

            await prisma.debtPayment.create({
              data: {
                debtId: pattern.matchId,
                paymentDate: tx.date,
                totalAmount: amount,
                principalAmount: principal,
                interestAmount: interest,
                remainingBalance,
                linkedTransactionId: tx.id,
              },
            });
            await prisma.debt.update({
              where: { id: pattern.matchId },
              data: { currentBalance: remainingBalance },
            });
            linked++;
          } else if (pattern.matchType === "bill") {
            const bill = await prisma.monthlyBill.findUnique({ where: { id: pattern.matchId } });
            if (!bill || !bill.isActive) continue;

            const txDate = new Date(tx.date);
            const dueDate = new Date(txDate.getFullYear(), txDate.getMonth(), bill.dueDayOfMonth);

            await prisma.billPayment.create({
              data: {
                monthlyBillId: pattern.matchId,
                dueDate,
                paidDate: tx.date,
                amountDue: bill.expectedAmount,
                amountPaid: Math.abs(Number(tx.amount)),
                status: "PAID",
                linkedTransactionId: tx.id,
              },
            });
            linked++;
          } else if (pattern.matchType === "recurring") {
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { recurringTransactionId: pattern.matchId },
            });
            linked++;
          }
        } catch {
          // Skip duplicates or constraint violations
          continue;
        }
        break; // Only one match per transaction
      }
    }
  }

  revalidatePath("/debts");
  revalidatePath("/bills");
  revalidatePath("/recurring");
  revalidatePath("/transactions/smart-link");
  return { linked };
}
