import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { ImportClient } from "./import-client";

export default async function WorkoutImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const members = await prisma.familyMember.findMany({
    where: { householdId, isActive: true },
    orderBy: { firstName: "asc" },
  });

  return (
    <ImportClient
      members={members.map((m) => ({ id: m.id, firstName: m.firstName }))}
    />
  );
}
