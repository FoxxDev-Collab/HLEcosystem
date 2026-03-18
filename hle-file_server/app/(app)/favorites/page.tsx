import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatFileSize, formatDateRelative } from "@/lib/format";
import { FileIcon } from "@/components/file-icon";
import { toggleFavoriteAction } from "./actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Star, Heart } from "lucide-react";
import Link from "next/link";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    include: {
      file: {
        include: { folder: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter to only files in this household that are active and not trashed
  const activeFavorites = favorites.filter(
    (fav) =>
      fav.file.householdId === householdId &&
      fav.file.status === "ACTIVE" &&
      fav.file.deletedAt === null
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
        <p className="text-muted-foreground">
          Files you&apos;ve starred for quick access
        </p>
      </div>

      {activeFavorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-16 text-center">
          <Star className="size-16 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">No favorites yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Star files from the browse or my files pages to see them here
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Folder</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Favorited</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeFavorites.map((fav) => {
                const detailUrl = fav.file.ownerId
                  ? `/my-files/${fav.file.id}`
                  : `/browse/${fav.file.id}`;

                return (
                  <TableRow key={fav.id}>
                    <TableCell>
                      <Link
                        href={detailUrl}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <FileIcon mimeType={fav.file.mimeType} className="size-5 shrink-0" />
                        <span className="truncate">{fav.file.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fav.file.folder?.name ?? "Root"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFileSize(fav.file.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateRelative(fav.createdAt)}
                    </TableCell>
                    <TableCell>
                      <form action={toggleFavoriteAction}>
                        <input type="hidden" name="fileId" value={fav.file.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="text-amber-500 hover:text-amber-600"
                          title="Remove from favorites"
                        >
                          <Heart className="size-4 fill-current" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
