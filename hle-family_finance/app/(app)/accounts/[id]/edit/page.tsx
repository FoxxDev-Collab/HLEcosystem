import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AccountForm } from "@/components/account-form";
import { updateAccountAction } from "../../actions";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const account = await prisma.account.findUnique({
    where: { id, householdId },
  });
  if (!account) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/accounts/${id}`}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit {account.name}</h1>
      </div>
      <AccountForm
        action={updateAccountAction}
        submitLabel="Save Changes"
        defaultValues={{
          id: account.id,
          name: account.name,
          type: account.type,
          institution: account.institution ?? "",
          color: account.color ?? "#6366f1",
        }}
      />
    </div>
  );
}
