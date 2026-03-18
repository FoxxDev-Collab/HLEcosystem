import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Download, Trash2,
  FileText, Image, FileSpreadsheet, File, ExternalLink,
} from "lucide-react";
import { updateDocumentAction, deleteDocumentAction } from "../actions";

const DOC_TYPES = ["MANUAL", "WARRANTY", "RECEIPT", "INVOICE", "PHOTO", "OTHER"];

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

function LargeFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="size-12 text-pink-400" />;
  if (mimeType === "application/pdf") return <FileText className="size-12 text-red-400" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="size-12 text-green-400" />;
  return <File className="size-12 text-muted-foreground" />;
}

function canPreviewInline(mimeType: string): "image" | "pdf" | "text" | "video" | "audio" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml") return "text";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return null;
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [doc, items, vehicles, repairs] = await Promise.all([
    prisma.document.findFirst({
      where: { id, householdId },
      include: { item: true, vehicle: true, repair: true },
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
    prisma.repair.findMany({
      where: { householdId },
      orderBy: { reportedDate: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
  ]);

  if (!doc) notFound();

  const previewType = canPreviewInline(doc.mimeType);
  const serveUrl = `/api/documents/serve/${doc.id}`;
  const downloadUrl = `/api/documents/download/${doc.id}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/documents">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">{doc.name}</h1>
            <Badge className={TYPE_COLORS[doc.type]}>{doc.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {doc.originalName} &middot; {formatFileSize(doc.size)} &middot; Uploaded {formatDate(doc.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={serveUrl} target="_blank">
            <Button variant="outline" size="sm">
              <ExternalLink className="size-3.5 mr-1.5" />Open
            </Button>
          </Link>
          <Link href={downloadUrl}>
            <Button variant="outline" size="sm">
              <Download className="size-3.5 mr-1.5" />Download
            </Button>
          </Link>
        </div>
      </div>

      {/* Preview */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          {previewType === "image" && (
            <div className="flex items-center justify-center bg-muted/30 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={serveUrl}
                alt={doc.name}
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>
          )}

          {previewType === "pdf" && (
            <div className="bg-muted/30">
              <iframe
                src={serveUrl}
                title={doc.name}
                className="w-full border-0"
                style={{ height: "80vh" }}
              />
            </div>
          )}

          {previewType === "video" && (
            <div className="flex items-center justify-center bg-black p-4">
              <video
                src={serveUrl}
                controls
                className="max-h-[70vh] max-w-full rounded"
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}

          {previewType === "audio" && (
            <div className="flex flex-col items-center justify-center bg-muted/30 p-8 gap-4">
              <LargeFileIcon mimeType={doc.mimeType} />
              <audio src={serveUrl} controls className="w-full max-w-md">
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {previewType === "text" && (
            <div className="bg-muted/30">
              <iframe
                src={serveUrl}
                title={doc.name}
                className="w-full border-0 font-mono text-sm"
                style={{ height: "60vh" }}
              />
            </div>
          )}

          {!previewType && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
              <LargeFileIcon mimeType={doc.mimeType} />
              <div className="text-center">
                <p className="text-sm font-medium">Preview not available</p>
                <p className="text-xs mt-1">{doc.mimeType}</p>
              </div>
              <Link href={downloadUrl}>
                <Button variant="outline" size="sm">
                  <Download className="size-3.5 mr-1.5" />Download to view
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked entity info */}
      {(doc.item || doc.vehicle || doc.repair) && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Linked to:</span>
              {doc.item && (
                <Link href={`/items/${doc.item.id}`} className="font-medium hover:underline">
                  {doc.item.name}
                </Link>
              )}
              {doc.vehicle && (
                <Link href={`/vehicles/${doc.vehicle.id}`} className="font-medium hover:underline">
                  {doc.vehicle.year ? `${doc.vehicle.year} ` : ""}{doc.vehicle.make} {doc.vehicle.model}
                </Link>
              )}
              {doc.repair && (
                <span className="font-medium">{doc.repair.title}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit details */}
      <Card>
        <CardHeader><CardTitle>Document Details</CardTitle></CardHeader>
        <CardContent>
          <form action={updateDocumentAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
            <input type="hidden" name="id" value={doc.id} />
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" defaultValue={doc.name} required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue={doc.type}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Link to Item</Label>
              <Select name="itemId" defaultValue={doc.itemId || "_none"}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Link to Vehicle</Label>
              <Select name="vehicleId" defaultValue={doc.vehicleId || "_none"}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.year ? `${v.year} ` : ""}{v.make} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Link to Repair</Label>
              <Select name="repairId" defaultValue={doc.repairId || "_none"}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {repairs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" defaultValue={doc.notes || ""} placeholder="Optional notes" />
            </div>
            <Button type="submit">Save Changes</Button>
          </form>

          {/* File info + delete */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Original: {doc.originalName}</p>
              <p>MIME: {doc.mimeType}</p>
              <p>Hash: {doc.contentHash.substring(0, 16)}...</p>
            </div>
            <form action={deleteDocumentAction}>
              <input type="hidden" name="id" value={doc.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-3.5 mr-1.5" />Delete Document
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
