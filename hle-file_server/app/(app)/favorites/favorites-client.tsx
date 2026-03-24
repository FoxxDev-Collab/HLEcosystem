"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useFiles } from "@/hooks/use-files";
import { useQueryClient } from "@tanstack/react-query";
import { formatFileSize, formatDateRelative } from "@/lib/format";
import { FileIcon } from "@/components/file-icon";
import { Skeleton } from "@/components/ui/skeleton";
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

export function FavoritesClient({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useFiles({
    mode: "favorites",
    limit: 200,
  });

  const files = useMemo(
    () => data?.pages.flatMap((p) => p.files) ?? [],
    [data]
  );

  const handleToggleFavorite = async (fileId: string) => {
    const mod = await import("./actions");
    const fd = new FormData();
    fd.append("fileId", fileId);
    await mod.toggleFavoriteAction(fd);
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
        <p className="text-muted-foreground">
          Files you&apos;ve starred for quick access
        </p>
      </div>

      {files.length === 0 ? (
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
                <TableHead className="hidden sm:table-cell">Size</TableHead>
                <TableHead className="hidden sm:table-cell">Modified</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <Link
                      href={`/browse/${file.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <FileIcon
                        mimeType={file.mimeType}
                        className="size-5 shrink-0"
                      />
                      <span className="truncate">{file.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {formatFileSize(BigInt(file.size))}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {formatDateRelative(file.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-amber-500 hover:text-amber-600"
                      title="Remove from favorites"
                      onClick={() => handleToggleFavorite(file.id)}
                    >
                      <Heart className="size-4 fill-current" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
