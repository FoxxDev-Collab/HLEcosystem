import prisma from "./prisma";

const DEFAULT_FOLDERS = [
  { name: "Documents", icon: "file-text", color: "#3B82F6", sortOrder: 0 },
  { name: "Photos", icon: "camera", color: "#8B5CF6", sortOrder: 1 },
  { name: "Uploads", icon: "upload", color: "#6B7280", sortOrder: 2 },
  { name: "Music", icon: "music", color: "#EC4899", sortOrder: 3 },
  { name: "Videos", icon: "video", color: "#F59E0B", sortOrder: 4 },
] as const;

/**
 * Ensure the 5 default personal folders exist for a user.
 * Called on first visit to My Files. Idempotent.
 */
export async function ensurePersonalFolders(
  householdId: string,
  userId: string
): Promise<void> {
  // Check if any personal system folders already exist for this user
  const existing = await prisma.folder.findMany({
    where: {
      householdId,
      ownerId: userId,
      parentFolderId: null,
      isSystem: true,
      deletedAt: null,
    },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((f) => f.name));
  const toCreate = DEFAULT_FOLDERS.filter((f) => !existingNames.has(f.name));

  if (toCreate.length === 0) return;

  await prisma.folder.createMany({
    data: toCreate.map((f) => ({
      householdId,
      parentFolderId: null,
      ownerId: userId,
      name: f.name,
      icon: f.icon,
      color: f.color,
      sortOrder: f.sortOrder,
      isSystem: true,
      createdByUserId: userId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Ensure the 5 default household-shared folders exist.
 * Called on first visit to All Files. Idempotent.
 */
export async function ensureHouseholdFolders(
  householdId: string,
  createdByUserId: string
): Promise<void> {
  // Check if any household system folders already exist
  const existing = await prisma.folder.findMany({
    where: {
      householdId,
      ownerId: null,
      parentFolderId: null,
      isSystem: true,
      deletedAt: null,
    },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((f) => f.name));
  const toCreate = DEFAULT_FOLDERS.filter((f) => !existingNames.has(f.name));

  if (toCreate.length === 0) return;

  await prisma.folder.createMany({
    data: toCreate.map((f) => ({
      householdId,
      parentFolderId: null,
      ownerId: null,
      name: f.name,
      icon: f.icon,
      color: f.color,
      sortOrder: f.sortOrder,
      isSystem: true,
      createdByUserId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Get the personal "Uploads" folder ID for a user (default upload target).
 * Ensures personal folders exist first.
 */
export async function getPersonalUploadsFolderId(
  householdId: string,
  userId: string
): Promise<string> {
  await ensurePersonalFolders(householdId, userId);

  const folder = await prisma.folder.findFirst({
    where: {
      householdId,
      ownerId: userId,
      parentFolderId: null,
      name: "Uploads",
      isSystem: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  // Should always exist after ensurePersonalFolders, but fallback
  if (!folder) {
    throw new Error("Personal Uploads folder not found after initialization");
  }

  return folder.id;
}

/**
 * Get the household "Photos" folder ID (used by Photos page).
 * Ensures household folders exist first.
 */
export async function getHouseholdPhotosFolderId(
  householdId: string,
  createdByUserId: string
): Promise<string> {
  await ensureHouseholdFolders(householdId, createdByUserId);

  const folder = await prisma.folder.findFirst({
    where: {
      householdId,
      ownerId: null,
      parentFolderId: null,
      name: "Photos",
      isSystem: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!folder) {
    throw new Error("Household Photos folder not found after initialization");
  }

  return folder.id;
}
