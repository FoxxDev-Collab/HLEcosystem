import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getFinanceAccounts, getFinanceExpenseCategories } from "@/lib/finance-bridge";
import { ReceiptScanner } from "@/components/receipt-scanner";

export default async function ReceiptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [stores, financeAccounts, financeCategories] = await Promise.all([
    prisma.store.findMany({
      where: { householdId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getFinanceAccounts(householdId),
    getFinanceExpenseCategories(householdId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Receipt Scanner</h1>
        <p className="text-muted-foreground">
          Scan grocery receipts to track prices and automatically log expenses in Family Finance.
        </p>
      </div>

      <ReceiptScanner
        stores={stores}
        financeAccounts={financeAccounts}
        financeCategories={financeCategories}
      />
    </div>
  );
}
