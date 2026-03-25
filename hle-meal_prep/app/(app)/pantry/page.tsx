import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { PantryClient } from "@/components/pantry-client";

export default async function PantryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const params = await searchParams;
  const searchQuery = params.q?.trim() || "";
  const filterTab = params.filter || "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pantry</h1>
        <p className="text-muted-foreground">
          Track what you have on hand
        </p>
      </div>

      <PantryClient initialFilter={filterTab} initialSearch={searchQuery} />
    </div>
  );
}
