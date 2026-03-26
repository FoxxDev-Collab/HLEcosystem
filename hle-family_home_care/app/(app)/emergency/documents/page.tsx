import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileKey, Trash2 } from "lucide-react";
import {
  createDocumentLocationAction,
  deleteDocumentLocationAction,
} from "../actions";

const DOCUMENT_CATEGORIES = [
  "Identification",
  "Insurance",
  "Financial",
  "Medical",
  "Legal",
  "Property",
  "Vehicle",
  "Education",
  "Employment",
  "Other",
];

export default async function EmergencyDocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const documents = await prisma.importantDocumentLocation.findMany({
    where: { householdId },
    orderBy: [{ category: "asc" }, { documentName: "asc" }],
  });

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Important Document Locations</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDocumentLocationAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Document Name</Label>
              <Input name="documentName" placeholder="e.g. Passport, Deed" required />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select name="category">
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Physical Location</Label>
              <Input name="physicalLocation" placeholder="e.g. Filing cabinet, safe" />
            </div>
            <div className="space-y-1">
              <Label>Digital Location</Label>
              <Input name="digitalLocation" placeholder="e.g. Google Drive, iCloud" />
            </div>
            <div className="space-y-1">
              <Label>Account Number</Label>
              <Input name="accountNumber" placeholder="Account #" />
            </div>
            <div className="space-y-1">
              <Label>Policy Number</Label>
              <Input name="policyNumber" placeholder="Policy #" />
            </div>
            <div className="space-y-1">
              <Label>Expiration Date</Label>
              <Input name="expirationDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Additional details" />
            </div>
            <Button type="submit">
              <Plus className="size-4 mr-2" />Add Document
            </Button>
          </form>
        </CardContent>
      </Card>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileKey className="size-10 mx-auto mb-3 opacity-40" />
            <p>No document locations recorded. Track where your important documents are stored.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Physical Location</TableHead>
                  <TableHead>Digital Location</TableHead>
                  <TableHead>Account / Policy #</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const isExpiring =
                    doc.expirationDate &&
                    doc.expirationDate <= thirtyDaysFromNow;
                  const isExpired =
                    doc.expirationDate && doc.expirationDate <= now;
                  return (
                    <TableRow
                      key={doc.id}
                      className={isExpired ? "bg-red-50 dark:bg-red-950/20" : isExpiring ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}
                    >
                      <TableCell className="font-medium">{doc.documentName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.category || "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.physicalLocation || "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.digitalLocation || "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {doc.accountNumber && <div>Acct: {doc.accountNumber}</div>}
                        {doc.policyNumber && <div>Policy: {doc.policyNumber}</div>}
                        {!doc.accountNumber && !doc.policyNumber && "--"}
                      </TableCell>
                      <TableCell>
                        {doc.expirationDate ? (
                          <span
                            className={
                              isExpired
                                ? "text-red-600 font-medium"
                                : isExpiring
                                  ? "text-yellow-600 font-medium"
                                  : ""
                            }
                          >
                            {formatDate(doc.expirationDate)}
                            {isExpired && (
                              <span className="text-xs block text-red-600">EXPIRED</span>
                            )}
                          </span>
                        ) : (
                          "--"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {doc.notes || "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={deleteDocumentLocationAction}>
                          <input type="hidden" name="id" value={doc.id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                            <Trash2 className="size-3.5 text-red-500" />
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
