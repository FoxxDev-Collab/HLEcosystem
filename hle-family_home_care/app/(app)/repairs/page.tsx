import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wrench, CheckCircle2, Trash2 } from "lucide-react";
import { createRepairAction, updateRepairStatusAction, deleteRepairAction } from "./actions";

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default async function RepairsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [items, vehicles, providers, repairs] = await Promise.all([
    prisma.item.findMany({
      where: { householdId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.vehicle.findMany({
      where: { householdId, isArchived: false },
      orderBy: { make: "asc" },
    }),
    prisma.serviceProvider.findMany({
      where: { householdId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.repair.findMany({
      where: { householdId },
      include: { item: true, vehicle: true, provider: true },
      orderBy: { reportedDate: "desc" },
      take: 50,
    }),
  ]);

  const active = repairs.filter((r) => r.status === "SCHEDULED" || r.status === "IN_PROGRESS");
  const completed = repairs.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED");

  const totalRepairCost = repairs
    .filter((r) => r.status === "COMPLETED" && r.totalCost)
    .reduce((sum, r) => sum + Number(r.totalCost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Repairs</h1>
        {totalRepairCost > 0 && (
          <div className="text-sm text-muted-foreground">
            Total spent: <span className="font-medium text-foreground">{formatCurrency(totalRepairCost)}</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Report Repair</CardTitle></CardHeader>
        <CardContent>
          <form action={createRepairAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>What needs repair?</Label>
              <Input name="title" placeholder="e.g. Dishwasher not draining" required />
            </div>
            <div className="space-y-1">
              <Label>Item</Label>
              <Select name="itemId">
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vehicle</Label>
              <Select name="vehicleId">
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.year ? `${v.year} ` : ""}{v.make} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Service Provider</Label>
              <Select name="providerId">
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.company ? ` (${p.company})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reported Date</Label>
              <Input name="reportedDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
            <div className="space-y-1">
              <Label>Scheduled Date</Label>
              <Input name="scheduledDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Labor Cost</Label>
              <Input name="laborCost" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Parts Cost</Label>
              <Input name="partsCost" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Done By</Label>
              <Input name="completedBy" placeholder="Self, contractor..." />
            </div>
            <div className="space-y-1">
              <Label>Parts Used</Label>
              <Input name="partsUsed" placeholder="List parts" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Details" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Report</Button>
          </form>
        </CardContent>
      </Card>

      {repairs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="size-10 mx-auto mb-3 opacity-40" />
            <p>No repairs recorded. Report issues when things break to build your repair history.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Active Repairs ({active.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead>Item / Vehicle</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Reported</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.item?.name || (r.vehicle ? `${r.vehicle.year ? `${r.vehicle.year} ` : ""}${r.vehicle.make} ${r.vehicle.model}` : "\u2014")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.provider?.name || "\u2014"}</TableCell>
                        <TableCell>{formatDate(r.reportedDate)}</TableCell>
                        <TableCell>{r.scheduledDate ? formatDate(r.scheduledDate) : "\u2014"}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[r.status]}>{r.status.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <form action={updateRepairStatusAction}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="COMPLETED" />
                              <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Mark Complete">
                                <CheckCircle2 className="size-3.5 text-green-600" />
                              </Button>
                            </form>
                            <form action={deleteRepairAction}>
                              <input type="hidden" name="id" value={r.id} />
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

          {completed.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-muted-foreground">Completed ({completed.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead>Item / Vehicle</TableHead>
                      <TableHead>Done By</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completed.map((r) => (
                      <TableRow key={r.id} className="opacity-70">
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.item?.name || (r.vehicle ? `${r.vehicle.year ? `${r.vehicle.year} ` : ""}${r.vehicle.make} ${r.vehicle.model}` : "\u2014")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.completedBy || r.provider?.name || "\u2014"}
                        </TableCell>
                        <TableCell>{formatDate(r.completedDate || r.reportedDate)}</TableCell>
                        <TableCell className="text-right">{r.totalCost ? formatCurrency(r.totalCost) : "\u2014"}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[r.status]}>{r.status.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <form action={deleteRepairAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button type="submit" variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="size-3.5 text-red-500" />
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
