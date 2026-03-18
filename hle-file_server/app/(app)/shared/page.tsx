import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
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
import { Share2, Inbox, Send, Trash2 } from "lucide-react";
import { FileIcon } from "@/components/file-icon";
import { removeShareAction } from "./actions";

export default async function SharedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const sharedWithMe = await prisma.fileShare.findMany({
    where: { sharedWithUserId: user.id },
    include: {
      file: {
        include: { folder: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const filteredSharedWithMe = sharedWithMe.filter(
    (share) => share.file.householdId === householdId
  );

  const sharedByMe = await prisma.fileShare.findMany({
    where: { sharedByUserId: user.id },
    include: {
      file: {
        include: { folder: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const filteredSharedByMe = sharedByMe.filter(
    (share) => share.file.householdId === householdId
  );

  function permissionColor(permission: string) {
    switch (permission) {
      case "EDIT":
        return "default";
      case "DOWNLOAD":
        return "secondary";
      default:
        return "outline";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shared Files</h1>
        <p className="text-muted-foreground">
          Files shared between household members
        </p>
      </div>

      <Tabs defaultValue="with-me">
        <TabsList>
          <TabsTrigger value="with-me" className="gap-2">
            <Inbox className="size-4" />
            Shared with Me ({filteredSharedWithMe.length})
          </TabsTrigger>
          <TabsTrigger value="by-me" className="gap-2">
            <Send className="size-4" />
            Shared by Me ({filteredSharedByMe.length})
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
              {filteredSharedWithMe.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No files have been shared with you yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Shared</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSharedWithMe.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileIcon mimeType={share.file.mimeType} />
                            <span className="font-medium">
                              {share.file.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {share.file.folder?.name ?? "Root"}
                        </TableCell>
                        <TableCell>{formatFileSize(share.file.size)}</TableCell>
                        <TableCell>
                          <Badge variant={permissionColor(share.permission)}>
                            {share.permission}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateRelative(share.createdAt)}
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
              {filteredSharedByMe.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  You haven&apos;t shared any files yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Shared With</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Shared</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSharedByMe.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileIcon mimeType={share.file.mimeType} />
                            <span className="font-medium">
                              {share.file.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {share.sharedWithUserId}
                        </TableCell>
                        <TableCell>{formatFileSize(share.file.size)}</TableCell>
                        <TableCell>
                          <Badge variant={permissionColor(share.permission)}>
                            {share.permission}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateRelative(share.createdAt)}
                        </TableCell>
                        <TableCell>
                          <form action={removeShareAction}>
                            <input
                              type="hidden"
                              name="shareId"
                              value={share.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              title="Remove share"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </form>
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
    </div>
  );
}
