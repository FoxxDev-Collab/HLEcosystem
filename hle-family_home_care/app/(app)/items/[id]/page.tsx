import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, ShieldCheck, Wrench, ClipboardList, FileText, Eye, Download } from "lucide-react";
import { updateItemAction, deleteItemAction, archiveItemAction } from "../actions";
import { DocumentUpload } from "@/components/document-upload";
import { deleteDocumentAction } from "../../documents/actions";

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "NEEDS_REPAIR", "DECOMMISSIONED"];

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [item, rooms] = await Promise.all([
    prisma.item.findFirst({
      where: { id, householdId },
      include: {
        room: true,
        maintenanceLogs: { orderBy: { completedDate: "desc" }, take: 10 },
        repairs: { orderBy: { reportedDate: "desc" }, take: 10, include: { provider: true } },
        documents: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.room.findMany({ where: { householdId }, orderBy: { name: "asc" } }),
  ]);

  if (!item) notFound();

  const now = new Date();
  const warrantyActive = item.warrantyExpires && item.warrantyExpires > now;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/items">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
          <p className="text-muted-foreground">
            {item.room?.name || "No room"}{item.manufacturer && ` · ${item.manufacturer}`}{item.model && ` ${item.model}`}
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <form action={updateItemAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
            <input type="hidden" name="id" value={item.id} />
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" defaultValue={item.name} required />
            </div>
            <div className="space-y-1">
              <Label>Room</Label>
              <Select name="roomId" defaultValue={item.roomId || ""}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Manufacturer</Label>
              <Input name="manufacturer" defaultValue={item.manufacturer || ""} />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input name="model" defaultValue={item.model || ""} />
            </div>
            <div className="space-y-1">
              <Label>Serial Number</Label>
              <Input name="serialNumber" defaultValue={item.serialNumber || ""} />
            </div>
            <div className="space-y-1">
              <Label>Condition</Label>
              <Select name="condition" defaultValue={item.condition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input name="purchaseDate" type="date" defaultValue={item.purchaseDate?.toISOString().split("T")[0] || ""} />
            </div>
            <div className="space-y-1">
              <Label>Purchase Price</Label>
              <Input name="purchasePrice" type="number" step="0.01" defaultValue={item.purchasePrice?.toString() || ""} />
            </div>
            <div className="space-y-1">
              <Label>Purchased From</Label>
              <Input name="purchasedFrom" defaultValue={item.purchasedFrom || ""} />
            </div>
            <div className="space-y-1">
              <Label>Warranty Expires</Label>
              <Input name="warrantyExpires" type="date" defaultValue={item.warrantyExpires?.toISOString().split("T")[0] || ""} />
            </div>
            <div className="space-y-1">
              <Label>Warranty Notes</Label>
              <Input name="warrantyNotes" defaultValue={item.warrantyNotes || ""} />
            </div>
            <div className="space-y-1">
              <Label>Manual URL</Label>
              <Input name="manualUrl" defaultValue={item.manualUrl || ""} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 space-y-1">
              <Label>Notes</Label>
              <Input name="notes" defaultValue={item.notes || ""} />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <form action={archiveItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" variant="outline" size="sm">Archive</Button>
            </form>
            <form action={deleteItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-3.5 mr-1" />Delete
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Warranty Status */}
      {item.warrantyExpires && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className={`size-5 ${warrantyActive ? "text-green-600" : "text-red-500"}`} />
              <div>
                <div className="text-sm font-medium">
                  Warranty {warrantyActive ? "Active" : "Expired"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {warrantyActive ? "Expires" : "Expired"} {formatDate(item.warrantyExpires)}
                  {item.warrantyNotes && ` — ${item.warrantyNotes}`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />Documents ({item.documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {item.documents.length > 0 && (
            <div className="divide-y mb-4">
              {item.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2">
                  <div className="text-sm">
                    <span className="font-medium">{doc.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{doc.type}</span>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/api/documents/serve/${doc.id}`} target="_blank">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="size-3.5" /></Button>
                    </Link>
                    <Link href={`/api/documents/download/${doc.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="size-3.5" /></Button>
                    </Link>
                    <form action={deleteDocumentAction}>
                      <input type="hidden" name="id" value={doc.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="size-3.5 text-red-500" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DocumentUpload itemId={item.id} compact />
        </CardContent>
      </Card>

      {/* Maintenance History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" />Maintenance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {item.maintenanceLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance records for this item.</p>
          ) : (
            <div className="divide-y">
              {item.maintenanceLogs.map((log) => (
                <div key={log.id} className="py-3">
                  <div className="text-sm font-medium">{log.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(log.completedDate)}
                    {log.completedBy && ` · ${log.completedBy}`}
                    {log.cost && ` · ${formatCurrency(log.cost)}`}
                  </div>
                  {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repair History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-4" />Repair History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {item.repairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repair records for this item.</p>
          ) : (
            <div className="divide-y">
              {item.repairs.map((repair) => (
                <div key={repair.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{repair.title}</div>
                    <Badge variant="secondary">{repair.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(repair.reportedDate)}
                    {repair.completedBy && ` · ${repair.completedBy}`}
                    {repair.provider && ` · ${repair.provider.name}`}
                    {repair.totalCost && ` · ${formatCurrency(repair.totalCost)}`}
                  </div>
                  {repair.notes && <p className="text-xs text-muted-foreground mt-1">{repair.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
