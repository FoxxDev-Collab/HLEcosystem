import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, Check, FileText, Pencil, DollarSign,
  Download, Paperclip, X,
} from "lucide-react";
import { TaxFileUpload } from "@/components/tax-file-upload";
import {
  updateTaxYearAction,
  updateTaxRefundAction,
  deleteTaxYearAction,
  addTaxDocumentAction,
  deleteTaxDocumentAction,
  markDocumentReceivedAction,
  markTaxFiledAction,
  markRefundReceivedAction,
  markOwedPaidAction,
  uploadTaxDocumentFileAction,
  deleteTaxDocumentFileAction,
} from "../actions";

const DOC_TYPES = [
  { value: "W2", label: "W-2" },
  { value: "FORM_1099_INT", label: "1099-INT" },
  { value: "FORM_1099_DIV", label: "1099-DIV" },
  { value: "FORM_1099_NEC", label: "1099-NEC" },
  { value: "FORM_1098", label: "1098" },
  { value: "FORM_1099_B", label: "1099-B" },
  { value: "FORM_1099_R", label: "1099-R" },
  { value: "K1", label: "K-1" },
  { value: "FORM_1099_SA", label: "1099-SA" },
  { value: "FORM_5498_SA", label: "5498-SA" },
  { value: "OTHER", label: "Other" },
];

const FILING_STATUSES = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED_FILING_JOINTLY", label: "Married Filing Jointly" },
  { value: "MARRIED_FILING_SEPARATELY", label: "Married Filing Separately" },
  { value: "HEAD_OF_HOUSEHOLD", label: "Head of Household" },
  { value: "QUALIFYING_WIDOWER", label: "Qualifying Widower" },
];

function docTypeLabel(value: string): string {
  return DOC_TYPES.find((d) => d.value === value)?.label ?? value.replace(/_/g, " ");
}

export default async function TaxYearDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const taxYear = await prisma.taxYear.findUnique({
    where: { id },
    include: { documents: { orderBy: { documentType: "asc" } } },
  });
  if (!taxYear || taxYear.householdId !== householdId) notFound();

  const totalIncome = taxYear.documents.reduce((sum, d) => sum + Number(d.grossAmount || 0), 0);
  const totalFedWithheld = taxYear.documents.reduce((sum, d) => sum + Number(d.federalWithheld || 0), 0);
  const totalStateWithheld = taxYear.documents.reduce((sum, d) => sum + Number(d.stateWithheld || 0), 0);
  const totalSSWithheld = taxYear.documents.reduce((sum, d) => sum + Number(d.socialSecurityWithheld || 0), 0);
  const totalMedicareWithheld = taxYear.documents.reduce((sum, d) => sum + Number(d.medicareWithheld || 0), 0);
  const receivedCount = taxYear.documents.filter((d) => d.isReceived).length;

  const hasRefund = Number(taxYear.federalRefund || 0) > 0 || Number(taxYear.stateRefund || 0) > 0;
  const hasOwed = Number(taxYear.federalOwed || 0) > 0 || Number(taxYear.stateOwed || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/taxes"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tax Year {taxYear.year}</h1>
            <p className="text-sm text-muted-foreground">
              {taxYear.federalFilingStatus?.replace(/_/g, " ")}
              {taxYear.state && ` \u00b7 ${taxYear.state}`}
            </p>
          </div>
        </div>
        <form action={deleteTaxYearAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="size-4 mr-2" />Delete Tax Year
          </Button>
        </form>
      </div>

      {/* Edit Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tax Year Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateTaxYearAction} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <div className="grid gap-4 sm:grid-cols-3 items-end">
              <div className="space-y-1">
                <Label>Filing Status</Label>
                <Select name="federalFilingStatus" defaultValue={taxYear.federalFilingStatus || ""}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {FILING_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input name="state" defaultValue={taxYear.state || ""} placeholder="e.g. AZ" />
              </div>
              <Button type="submit" className="sm:self-end">
                <Pencil className="size-4 mr-2" />Update
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                name="notes"
                defaultValue={taxYear.notes || ""}
                placeholder="Notes about this tax year..."
                rows={3}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Federal Withheld</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalFedWithheld)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">State Withheld</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStateWithheld)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SS Withheld</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSSWithheld)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Medicare Withheld</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMedicareWithheld)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filing Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filing Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Federal:</span>
            {taxYear.isFederalFiled ? (
              <Badge className="bg-green-100 text-green-800">
                Filed {taxYear.federalFiledDate && formatDate(taxYear.federalFiledDate)}
              </Badge>
            ) : (
              <form action={markTaxFiledAction}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="type" value="federal" />
                <Button type="submit" variant="outline" size="sm">Mark Federal Filed</Button>
              </form>
            )}
          </div>
          {taxYear.state && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">State ({taxYear.state}):</span>
              {taxYear.isStateFiled ? (
                <Badge className="bg-green-100 text-green-800">
                  Filed {taxYear.stateFiledDate && formatDate(taxYear.stateFiledDate)}
                </Badge>
              ) : (
                <form action={markTaxFiledAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="type" value="state" />
                  <Button type="submit" variant="outline" size="sm">Mark State Filed</Button>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund & Owed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="size-4" />
            Refund & Amount Owed
          </CardTitle>
          <CardDescription>Track your tax return outcome</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={updateTaxRefundAction} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Federal Refund</Label>
                <Input
                  name="federalRefund"
                  type="number"
                  step="0.01"
                  defaultValue={taxYear.federalRefund ? Number(taxYear.federalRefund) : ""}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>State Refund</Label>
                <Input
                  name="stateRefund"
                  type="number"
                  step="0.01"
                  defaultValue={taxYear.stateRefund ? Number(taxYear.stateRefund) : ""}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>Federal Owed</Label>
                <Input
                  name="federalOwed"
                  type="number"
                  step="0.01"
                  defaultValue={taxYear.federalOwed ? Number(taxYear.federalOwed) : ""}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>State Owed</Label>
                <Input
                  name="stateOwed"
                  type="number"
                  step="0.01"
                  defaultValue={taxYear.stateOwed ? Number(taxYear.stateOwed) : ""}
                  placeholder="0.00"
                />
              </div>
            </div>
            <Button type="submit">Save Amounts</Button>
          </form>

          {(hasRefund || hasOwed) && (
            <div className="flex flex-wrap gap-3 pt-3 border-t">
              {hasRefund && (
                <form action={markRefundReceivedAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="refundReceived" value={String(taxYear.refundReceived)} />
                  <Button type="submit" variant={taxYear.refundReceived ? "default" : "outline"} size="sm">
                    {taxYear.refundReceived ? (
                      <><Check className="size-3.5 mr-1" />Refund Received {taxYear.refundReceivedDate && `(${formatDate(taxYear.refundReceivedDate)})`}</>
                    ) : (
                      "Mark Refund Received"
                    )}
                  </Button>
                </form>
              )}
              {Number(taxYear.federalOwed || 0) > 0 && (
                <form action={markOwedPaidAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="type" value="federal" />
                  <Button type="submit" variant={taxYear.federalOwedPaid ? "default" : "outline"} size="sm">
                    {taxYear.federalOwedPaid ? (
                      <><Check className="size-3.5 mr-1" />Federal Paid</>
                    ) : (
                      "Mark Federal Paid"
                    )}
                  </Button>
                </form>
              )}
              {Number(taxYear.stateOwed || 0) > 0 && (
                <form action={markOwedPaidAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="type" value="state" />
                  <Button type="submit" variant={taxYear.stateOwedPaid ? "default" : "outline"} size="sm">
                    {taxYear.stateOwedPaid ? (
                      <><Check className="size-3.5 mr-1" />State Paid</>
                    ) : (
                      "Mark State Paid"
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tax Documents ({taxYear.documents.length})</CardTitle>
          <CardDescription>{receivedCount} of {taxYear.documents.length} received</CardDescription>
        </CardHeader>
        <CardContent>
          {taxYear.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No documents yet. Add one below.</p>
          ) : (
            <div className="divide-y">
              {taxYear.documents.map((doc) => (
                <div key={doc.id} className="py-3 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {docTypeLabel(doc.documentType)} &mdash; {doc.issuer}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                          {doc.grossAmount && <span>Gross: {formatCurrency(doc.grossAmount)}</span>}
                          {doc.federalWithheld && <span>Fed: {formatCurrency(doc.federalWithheld)}</span>}
                          {doc.stateWithheld && <span>State: {formatCurrency(doc.stateWithheld)}</span>}
                          {doc.socialSecurityWithheld && <span>SS: {formatCurrency(doc.socialSecurityWithheld)}</span>}
                          {doc.medicareWithheld && <span>Medicare: {formatCurrency(doc.medicareWithheld)}</span>}
                        </div>
                        {doc.description && (
                          <div className="text-xs text-muted-foreground">{doc.description}</div>
                        )}
                        {doc.notes && (
                          <div className="text-xs text-muted-foreground italic">{doc.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <form action={markDocumentReceivedAction}>
                        <input type="hidden" name="id" value={doc.id} />
                        <input type="hidden" name="taxYearId" value={id} />
                        <input type="hidden" name="isReceived" value={String(doc.isReceived)} />
                        <Button type="submit" variant={doc.isReceived ? "default" : "outline"} size="sm">
                          {doc.isReceived ? <><Check className="size-3.5 mr-1" />Received</> : "Mark Received"}
                        </Button>
                      </form>
                      <form action={deleteTaxDocumentAction}>
                        <input type="hidden" name="id" value={doc.id} />
                        <input type="hidden" name="taxYearId" value={id} />
                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                  {/* File attachment */}
                  <div className="ml-7">
                    {doc.uploadedFileName ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Paperclip className="size-3 text-muted-foreground" />
                        <a
                          href={`/api/taxes/download/${doc.id}`}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Download className="size-3" />
                          {doc.uploadedFileName}
                        </a>
                        <span className="text-muted-foreground">
                          ({doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : ""})
                        </span>
                        <form action={deleteTaxDocumentFileAction}>
                          <input type="hidden" name="documentId" value={doc.id} />
                          <input type="hidden" name="taxYearId" value={id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive">
                            <X className="size-3" />
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <TaxFileUpload
                        action={uploadTaxDocumentFileAction}
                        documentId={doc.id}
                        taxYearId={id}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Document */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addTaxDocumentAction} className="space-y-4">
            <input type="hidden" name="taxYearId" value={id} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select name="documentType" defaultValue="W2">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Issuer</Label>
                <Input name="issuer" placeholder="Employer or institution" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Description</Label>
                <Input name="description" placeholder="Optional description" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
              <div className="space-y-1">
                <Label>Gross Amount</Label>
                <Input name="grossAmount" type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Federal Withheld</Label>
                <Input name="federalWithheld" type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>State Withheld</Label>
                <Input name="stateWithheld" type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>SS Withheld</Label>
                <Input name="socialSecurityWithheld" type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Medicare Withheld</Label>
                <Input name="medicareWithheld" type="number" step="0.01" placeholder="0.00" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 items-end">
              <div className="space-y-1">
                <Label>Expected Date</Label>
                <Input name="expectedDate" type="date" />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input name="notes" placeholder="Optional notes" />
              </div>
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Document</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
