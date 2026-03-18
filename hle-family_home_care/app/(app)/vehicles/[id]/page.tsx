import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency, formatMileage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Gauge, ClipboardList, Wrench, FileText, Eye, Download } from "lucide-react";
import { updateVehicleAction, deleteVehicleAction } from "../actions";
import { DocumentUpload } from "@/components/document-upload";
import { deleteDocumentAction } from "../../documents/actions";

const STATUSES = ["ACTIVE", "SOLD", "SCRAPPED", "STORED"];

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, householdId },
    include: {
      mileageEntries: { orderBy: { date: "desc" }, take: 20 },
      maintenanceLogs: { orderBy: { completedDate: "desc" }, take: 10 },
      repairs: { orderBy: { reportedDate: "desc" }, take: 10, include: { provider: true } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!vehicle) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/vehicles">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {vehicle.year ? `${vehicle.year} ` : ""}{vehicle.make} {vehicle.model}
          </h1>
          <p className="text-muted-foreground">
            {vehicle.currentMileage ? formatMileage(vehicle.currentMileage) : "No mileage recorded"}
            {vehicle.licensePlate && ` · ${vehicle.licensePlate}`}
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <form action={updateVehicleAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
            <input type="hidden" name="id" value={vehicle.id} />
            <div className="space-y-1">
              <Label>Year</Label>
              <Input name="year" type="number" defaultValue={vehicle.year || ""} />
            </div>
            <div className="space-y-1">
              <Label>Make</Label>
              <Input name="make" defaultValue={vehicle.make} required />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input name="model" defaultValue={vehicle.model} required />
            </div>
            <div className="space-y-1">
              <Label>Trim</Label>
              <Input name="trim" defaultValue={vehicle.trim || ""} />
            </div>
            <div className="space-y-1">
              <Label>VIN</Label>
              <Input name="vin" defaultValue={vehicle.vin || ""} />
            </div>
            <div className="space-y-1">
              <Label>License Plate</Label>
              <Input name="licensePlate" defaultValue={vehicle.licensePlate || ""} />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input name="color" defaultValue={vehicle.color || ""} />
            </div>
            <div className="space-y-1">
              <Label>Current Mileage</Label>
              <Input name="currentMileage" type="number" defaultValue={vehicle.currentMileage || ""} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select name="status" defaultValue={vehicle.status}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input name="purchaseDate" type="date" defaultValue={vehicle.purchaseDate?.toISOString().split("T")[0] || ""} />
            </div>
            <div className="space-y-1">
              <Label>Purchase Price</Label>
              <Input name="purchasePrice" type="number" step="0.01" defaultValue={vehicle.purchasePrice?.toString() || ""} />
            </div>
            <div className="space-y-1">
              <Label>Purchased From</Label>
              <Input name="purchasedFrom" defaultValue={vehicle.purchasedFrom || ""} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 space-y-1">
              <Label>Notes</Label>
              <Input name="notes" defaultValue={vehicle.notes || ""} />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <form action={deleteVehicleAction}>
              <input type="hidden" name="id" value={vehicle.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-3.5 mr-1" />Delete
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />Documents ({vehicle.documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vehicle.documents.length > 0 && (
            <div className="divide-y mb-4">
              {vehicle.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2">
                  <Link href={`/documents/${doc.id}`} className="text-sm hover:underline">
                    <span className="font-medium">{doc.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{doc.type}</span>
                  </Link>
                  <div className="flex gap-1">
                    <Link href={`/documents/${doc.id}`}>
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
          <DocumentUpload vehicleId={vehicle.id} compact />
        </CardContent>
      </Card>

      {/* Mileage History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="size-4" />Mileage History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vehicle.mileageEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mileage entries. <Link href="/mileage" className="underline">Log mileage</Link></p>
          ) : (
            <div className="divide-y">
              {vehicle.mileageEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2">
                  <div className="text-sm">{formatDate(entry.date)}</div>
                  <div className="text-sm font-medium">{formatMileage(entry.mileage)}</div>
                </div>
              ))}
            </div>
          )}
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
          {vehicle.maintenanceLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance records for this vehicle.</p>
          ) : (
            <div className="divide-y">
              {vehicle.maintenanceLogs.map((log) => (
                <div key={log.id} className="py-3">
                  <div className="text-sm font-medium">{log.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(log.completedDate)}
                    {log.completedBy && ` · ${log.completedBy}`}
                    {log.mileageAtService && ` · ${formatMileage(log.mileageAtService)}`}
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
          {vehicle.repairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repair records for this vehicle.</p>
          ) : (
            <div className="divide-y">
              {vehicle.repairs.map((repair) => (
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
