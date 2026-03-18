import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Eye, Trash2, Image, FileSpreadsheet, File } from "lucide-react";
import { DocumentUpload } from "@/components/document-upload";
import { deleteDocumentAction } from "./actions";

const TYPE_COLORS: Record<string, string> = {
  MANUAL: "bg-blue-100 text-blue-800",
  WARRANTY: "bg-green-100 text-green-800",
  RECEIPT: "bg-yellow-100 text-yellow-800",
  INVOICE: "bg-purple-100 text-purple-800",
  PHOTO: "bg-pink-100 text-pink-800",
  OTHER: "bg-gray-100 text-gray-800",
};

function formatFileSize(bytes: bigint | number): string {
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="size-4 text-pink-500" />;
  if (mimeType === "application/pdf") return <FileText className="size-4 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="size-4 text-green-500" />;
  return <File className="size-4 text-muted-foreground" />;
}

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [documents, items, vehicles] = await Promise.all([
    prisma.document.findMany({
      where: { householdId },
      include: { item: true, vehicle: true, repair: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.item.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.vehicle.findMany({
      where: { householdId, isArchived: false },
      orderBy: { make: "asc" },
      select: { id: true, year: true, make: true, model: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Documents</h1>

      <Card>
        <CardHeader><CardTitle>Upload Document</CardTitle></CardHeader>
        <CardContent>
          <DocumentUpload items={items} vehicles={vehicles} />
        </CardContent>
      </Card>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="size-10 mx-auto mb-3 opacity-40" />
            <p>No documents uploaded yet. Upload manuals, warranties, receipts, and more.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>All Documents ({documents.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Link href={`/documents/${doc.id}`} className="flex items-center gap-2 hover:underline">
                        <FileIcon mimeType={doc.mimeType} />
                        <div>
                          <div className="font-medium text-sm">{doc.name}</div>
                          {doc.notes && (
                            <p className="text-xs text-muted-foreground max-w-[200px] truncate">{doc.notes}</p>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={TYPE_COLORS[doc.type]}>{doc.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {doc.item ? (
                        <Link href={`/items/${doc.item.id}`} className="underline">{doc.item.name}</Link>
                      ) : doc.vehicle ? (
                        <Link href={`/vehicles/${doc.vehicle.id}`} className="underline">
                          {doc.vehicle.year ? `${doc.vehicle.year} ` : ""}{doc.vehicle.make} {doc.vehicle.model}
                        </Link>
                      ) : doc.repair ? (
                        <span>{doc.repair.title}</span>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatFileSize(doc.size)}</TableCell>
                    <TableCell className="text-sm">{formatDate(doc.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link href={`/documents/${doc.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="View">
                            <Eye className="size-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/api/documents/download/${doc.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
                            <Download className="size-3.5" />
                          </Button>
                        </Link>
                        <form action={deleteDocumentAction}>
                          <input type="hidden" name="id" value={doc.id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                            <Trash2 className="size-3.5 text-red-500" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
