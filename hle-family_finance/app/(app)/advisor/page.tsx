import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { AdvisorReport } from "@/lib/claude-api";
import { BrainCircuit } from "lucide-react";
import { AdvisorReportView } from "./advisor-report";

export default async function AdvisorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  // Get the latest cached report
  const cached = await prisma.advisorReport.findFirst({
    where: { householdId },
    orderBy: { generatedAt: "desc" },
  });

  const cachedReport = cached
    ? (cached.reportData as unknown as AdvisorReport)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BrainCircuit className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Advisor</h1>
          <p className="text-muted-foreground">
            AI-powered analysis of your household finances
          </p>
        </div>
      </div>

      <AdvisorReportView cachedReport={cachedReport} />
    </div>
  );
}
