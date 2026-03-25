import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { getMealieConfig } from "@/lib/mealie";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { SmartListGenerator } from "@/components/smart-list-generator";

export default async function GenerateListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const mealieConfig = await getMealieConfig(householdId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/shopping-lists"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Smart Shopping List
          </h1>
          <p className="text-muted-foreground text-sm">
            Generate an optimized list from your weekly meal plan, minus what&apos;s in your pantry.
          </p>
        </div>
      </div>

      <SmartListGenerator mealieConnected={!!mealieConfig} />
    </div>
  );
}
