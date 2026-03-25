import prisma from "./prisma";

/**
 * Cross-schema bridge to family_finance tables.
 * Uses $queryRaw for cross-schema access (same DB, different schema).
 */

export type FinanceAccount = {
  id: string;
  name: string;
  type: string;
};

export type FinanceCategory = {
  id: string;
  name: string;
  color: string | null;
};

export async function getFinanceAccounts(householdId: string): Promise<FinanceAccount[]> {
  return prisma.$queryRaw<FinanceAccount[]>`
    SELECT "id", "name", "type"
    FROM family_finance."Account"
    WHERE "householdId" = ${householdId}
      AND "isArchived" = false
    ORDER BY "name" ASC
  `;
}

export async function getFinanceExpenseCategories(householdId: string): Promise<FinanceCategory[]> {
  return prisma.$queryRaw<FinanceCategory[]>`
    SELECT "id", "name", "color"
    FROM family_finance."Category"
    WHERE "householdId" = ${householdId}
      AND "isArchived" = false
      AND "type" = 'EXPENSE'
    ORDER BY "sortOrder" ASC
  `;
}

export async function createFinanceTransaction(params: {
  householdId: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  date: Date;
  payee: string;
  description: string;
  createdByUserId: string;
}): Promise<void> {
  const { householdId, accountId, categoryId, amount, date, payee, description, createdByUserId } = params;
  const absAmount = Math.abs(amount);

  // Verify account belongs to household
  const accounts = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM family_finance."Account"
    WHERE "id" = ${accountId} AND "householdId" = ${householdId}
  `;
  if (accounts.length === 0) return;

  // Create transaction
  await prisma.$queryRaw`
    INSERT INTO family_finance."Transaction" (
      "id", "householdId", "type", "accountId", "categoryId",
      "amount", "date", "payee", "description", "createdByUserId",
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${householdId}, 'EXPENSE', ${accountId}, ${categoryId},
      ${absAmount}, ${date}, ${payee}, ${description}, ${createdByUserId},
      NOW(), NOW()
    )
  `;

  // Update account balance
  await prisma.$queryRaw`
    UPDATE family_finance."Account"
    SET "currentBalance" = "currentBalance" - ${absAmount},
        "updatedAt" = NOW()
    WHERE "id" = ${accountId}
  `;
}
