"use client";

import { useFiles } from "@/hooks/use-files";
import { useMemo } from "react";
import { formatFileSize, formatDateRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2, Inbox, Send, Trash2 } from "lucide-react";
import { FileIcon } from "@/components/file-icon";
import { removeShareAction } from "./actions";

function permissionColor(permission: string) {
  switch (permission) {
    case "EDIT":
      return "default" as const;
    case "DOWNLOAD":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function SharedClient({ userId }: { userId: string }) {
  const { data: sharedWithMe, isLoading: loadingWithMe } = useFiles({
    mode: "shared-with",
    limit: 200,
  });

  const { data: sharedByMe, isLoading: loadingByMe } = useFiles({
    mode: "shared-by",
    limit: 200,
  });

  const withMeFiles = useMemo(
    () => sharedWithMe?.pages.flatMap((p) => p.files) ?? [],
    [sharedWithMe]
  );

  const byMeFiles = useMemo(
    () => sharedByMe?.pages.flatMap((p) => p.files) ?? [],
    [sharedByMe]
  );

  const isLoading = loadingWithMe || loadingByMe;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shared Files</h1>
        <p className="text-muted-foreground">
          Files shared between household members
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="with-me">
          <TabsList>
            <TabsTrigger value="with-me" className="gap-2">
              <Inbox className="size-4" />
              Shared with Me ({withMeFiles.length})
            </TabsTrigger>
            <TabsTrigger value="by-me" className="gap-2">
              <Send className="size-4" />
              Shared by Me ({byMeFiles.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="with-me">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="size-5" />
                  Shared with Me
                </CardTitle>
              </CardHeader>
              <CardContent>
                {withMeFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No files have been shared with you yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Size</TableHead>
                        <TableHead className="hidden sm:table-cell">Shared</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withMeFiles.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileIcon mimeType={file.mimeType} />
                              <span className="font-medium">{file.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatFileSize(BigInt(file.size))}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {formatDateRelative(file.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-me">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="size-5" />
                  Shared by Me
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byMeFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    You haven&apos;t shared any files yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Size</TableHead>
                        <TableHead className="hidden sm:table-cell">Shared</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byMeFiles.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileIcon mimeType={file.mimeType} />
                              <span className="font-medium">{file.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatFileSize(BigInt(file.size))}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {formatDateRelative(file.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
