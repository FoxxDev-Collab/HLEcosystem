"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Trash2, AlertTriangle } from "lucide-react";
import { formatDate, daysUntil } from "@/lib/format";
import { createDocumentAction, deleteDocumentAction } from "@/app/(app)/documents/actions";
import type { HouseholdMember } from "@/lib/household-members";

const DOCUMENT_TYPES = [
  "PASSPORT", "VISA", "TRAVEL_INSURANCE", "DRIVERS_LICENSE",
  "VACCINATION_RECORD", "ITINERARY", "BOOKING_CONFIRMATION", "OTHER",
] as const;

type SerializedDocument = {
  id: string;
  householdId: string;
  tripId: string | null;
  householdMemberId: string | null;
  displayName: string | null;
  type: string;
  documentNumber: string | null;
  issuingCountry: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  fileServerFileId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  trip: { id: string; name: string } | null;
};

function expiryBadge(expiryDate: string | null) {
  if (!expiryDate) return null;
  const days = daysUntil(expiryDate);
  if (days === null) return null;
  if (days < 0) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (days <= 30) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="size-3" /> {days}d left
      </Badge>
    );
  }
  if (days <= 90) {
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        {days}d left
      </Badge>
    );
  }
  return <Badge variant="outline">{days}d left</Badge>;
}

export function DocumentsList({
  documents,
  trips,
  householdMembers,
}: {
  documents: SerializedDocument[];
  trips: { id: string; name: string }[];
  householdMembers: HouseholdMember[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Group by type
  const grouped = documents.reduce<Record<string, SerializedDocument[]>>((acc, doc) => {
    const key = doc.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await createDocumentAction(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setAddOpen(false);
    }
  }

  async function handleDelete(formData: FormData) {
    await deleteDocumentAction(formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Travel Documents</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" /> Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Travel Document</DialogTitle>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Document Type *</Label>
                <Select name="type" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select name="householdMemberId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {householdMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-display">Display Name</Label>
                <Input id="doc-display" name="displayName" placeholder="Name shown on document" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-number">Document Number</Label>
                <Input id="doc-number" name="documentNumber" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-country">Issuing Country</Label>
                <Input id="doc-country" name="issuingCountry" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-issue">Issue Date</Label>
                  <Input id="doc-issue" name="issueDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-expiry">Expiry Date</Label>
                  <Input id="doc-expiry" name="expiryDate" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link to Trip</Label>
                <Select name="tripId">
                  <SelectTrigger>
                    <SelectValue placeholder="None (general document)" />
                  </SelectTrigger>
                  <SelectContent>
                    {trips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-notes">Notes</Label>
                <Textarea id="doc-notes" name="notes" rows={2} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Adding..." : "Add Document"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto size-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No travel documents</h3>
            <p className="text-sm text-muted-foreground">
              Add passports, visas, and other travel documents to keep track of them.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, docs]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" />
                {type.replace(/_/g, " ")}
                <Badge variant="secondary" className="text-xs">{docs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {doc.displayName || doc.documentNumber || type.replace(/_/g, " ")}
                        </span>
                        {expiryBadge(doc.expiryDate)}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {doc.documentNumber && <span>No: {doc.documentNumber}</span>}
                        {doc.issuingCountry && <span>Country: {doc.issuingCountry}</span>}
                        {doc.issueDate && <span>Issued: {formatDate(doc.issueDate)}</span>}
                        {doc.expiryDate && <span>Expires: {formatDate(doc.expiryDate)}</span>}
                        {doc.trip && <span>Trip: {doc.trip.name}</span>}
                      </div>
                      {doc.notes && <p className="text-xs text-muted-foreground">{doc.notes}</p>}
                    </div>
                    <form action={handleDelete}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
