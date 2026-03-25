import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import { BrowseClient } from "@/components/browse-client";
import { ensurePersonalFolders } from "@/lib/default-folders";

export default async function MyFilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  await ensurePersonalFolders(householdId, user.id);

  return (
    <BrowseClient
      userId={user.id}
      baseUrl="/my-files"
      isPersonal
      title="My Files"
      subtitle="Your personal file storage"
      showSearch={false}
    />
  );
}
