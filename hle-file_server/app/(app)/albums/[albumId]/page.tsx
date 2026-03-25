import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { AlbumDetailClient } from "@/components/album-detail-client";

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const { albumId } = await params;

  const album = await prisma.album.findFirst({
    where: { id: albumId, householdId },
    include: {
      files: {
        include: {
          file: {
            select: {
              id: true,
              name: true,
              mimeType: true,
              size: true,
              createdAt: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!album) notFound();

  const serializedAlbum = {
    id: album.id,
    name: album.name,
    description: album.description,
    coverFileId: album.coverFileId,
    createdAt: album.createdAt.toISOString(),
    updatedAt: album.updatedAt.toISOString(),
    files: album.files.map((af) => ({
      id: af.file.id,
      name: af.file.name,
      mimeType: af.file.mimeType,
      size: af.file.size.toString(),
      createdAt: af.file.createdAt.toISOString(),
    })),
  };

  return <AlbumDetailClient album={serializedAlbum} />;
}
