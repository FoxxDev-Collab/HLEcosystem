import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import { getHouseholdPhotosFolderId } from "@/lib/default-folders";
import { PhotosClient } from "@/components/photos-client";

export default async function PhotosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const photosFolderId = await getHouseholdPhotosFolderId(householdId, user.id);

  return <PhotosClient userId={user.id} photosFolderId={photosFolderId} />;
}
