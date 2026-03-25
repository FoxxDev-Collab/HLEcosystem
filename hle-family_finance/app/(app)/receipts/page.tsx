import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { ReceiptScanner } from "@/components/receipt-scanner";

export default async function ReceiptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.category.findMany({
      where: { householdId, isArchived: false, type: "EXPENSE" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Receipt Scanner</h1>
        <p className="text-muted-foreground">
          Snap a photo of your receipt and let Claude extract the details automatically.
        </p>
      </div>

      <ReceiptScanner
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      />
    </div>
  );
}
