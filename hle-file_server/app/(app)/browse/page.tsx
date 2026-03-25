import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import { BrowseClient } from "@/components/browse-client";
import { ensureHouseholdFolders } from "@/lib/default-folders";

export default async function BrowsePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  await ensureHouseholdFolders(householdId, user.id);

  return (
    <BrowseClient
      userId={user.id}
      baseUrl="/browse"
      title="Files"
      subtitle="Browse and manage your household files"
    />
  );
}
