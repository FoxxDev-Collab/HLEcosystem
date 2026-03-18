import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowRight, FileText, Receipt } from "lucide-react";
import { createTaxYearAction } from "./actions";

const FILING_STATUSES = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED_FILING_JOINTLY", label: "Married Filing Jointly" },
  { value: "MARRIED_FILING_SEPARATELY", label: "Married Filing Separately" },
  { value: "HEAD_OF_HOUSEHOLD", label: "Head of Household" },
  { value: "QUALIFYING_WIDOWER", label: "Qualifying Widower" },
];

export default async function TaxesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const taxYears = await prisma.taxYear.findMany({
    where: { householdId },
    include: { documents: true },
    orderBy: { year: "desc" },
  });

  const yearsWithResults = taxYears.filter(
    (ty) =>
      Number(ty.federalRefund || 0) > 0 ||
      Number(ty.stateRefund || 0) > 0 ||
      Number(ty.federalOwed || 0) > 0 ||
      Number(ty.stateOwed || 0) > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Tracking</h1>
          <p className="text-sm text-muted-foreground">
            {taxYears.length} tax year{taxYears.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Add Tax Year */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Tax Year</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTaxYearAction} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>Year</Label>
              <Input name="year" type="number" defaultValue={new Date().getFullYear() - 1} className="w-24" required />
            </div>
            <div className="space-y-1">
              <Label>Filing Status</Label>
              <Select name="federalFilingStatus" defaultValue="MARRIED_FILING_JOINTLY">
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILING_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input name="state" placeholder="e.g. AZ" className="w-20" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Year</Button>
          </form>
        </CardContent>
      </Card>

      {/* Refund & Owed History */}
      {yearsWithResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="size-4" />
              Refund & Owed History
            </CardTitle>
            <CardDescription>Tax outcomes by year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Year</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Federal</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">State</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Net</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {yearsWithResults.map((ty) => {
                    const fedRefund = Number(ty.federalRefund || 0);
                    const fedOwed = Number(ty.federalOwed || 0);
                    const stateRefund = Number(ty.stateRefund || 0);
                    const stateOwed = Number(ty.stateOwed || 0);
                    const fedNet = fedRefund - fedOwed;
                    const stateNet = stateRefund - stateOwed;
                    const totalNet = fedNet + stateNet;

                    return (
                      <tr key={ty.id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link href={`/taxes/${ty.id}`} className="hover:underline font-medium">
                            {ty.year}
                          </Link>
                        </td>
                        <td className={`text-right py-2 ${fedNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {fedNet >= 0 ? "+" : ""}{formatCurrency(fedNet)}
                        </td>
                        <td className={`text-right py-2 ${stateNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {stateNet >= 0 ? "+" : ""}{formatCurrency(stateNet)}
                        </td>
                        <td className={`text-right py-2 font-medium ${totalNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {totalNet >= 0 ? "+" : ""}{formatCurrency(totalNet)}
                        </td>
                        <td className="text-right py-2">
                          <div className="flex justify-end gap-1">
                            {hasRefundAndReceived(ty) && (
                              <Badge variant="outline" className="text-green-700 border-green-300 text-xs">Received</Badge>
                            )}
                            {hasRefundNotReceived(ty) && (
                              <Badge variant="outline" className="text-yellow-700 border-yellow-300 text-xs">Pending</Badge>
                            )}
                            {ty.federalOwedPaid && (
                              <Badge variant="outline" className="text-green-700 border-green-300 text-xs">Fed Paid</Badge>
                            )}
                            {ty.stateOwedPaid && (
                              <Badge variant="outline" className="text-green-700 border-green-300 text-xs">State Paid</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Year Cards */}
      {taxYears.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="size-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No tax years yet. Add one above to get started.</p>
          </CardContent>
        </Card>
      ) : (
        taxYears.map((ty) => {
          const totalIncome = ty.documents.reduce((sum, d) => sum + Number(d.grossAmount || 0), 0);
          const totalFedWithheld = ty.documents.reduce((sum, d) => sum + Number(d.federalWithheld || 0), 0);
          const totalStateWithheld = ty.documents.reduce((sum, d) => sum + Number(d.stateWithheld || 0), 0);
          const receivedCount = ty.documents.filter((d) => d.isReceived).length;

          return (
            <Link key={ty.id} href={`/taxes/${ty.id}`} className="block">
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Tax Year {ty.year}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {ty.federalFilingStatus?.replace(/_/g, " ")}
                        {ty.state && ` \u00b7 ${ty.state}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ty.isFederalFiled && (
                        <Badge className="bg-green-100 text-green-800 text-xs">Federal Filed</Badge>
                      )}
                      {ty.state && ty.isStateFiled && (
                        <Badge className="bg-green-100 text-green-800 text-xs">State Filed</Badge>
                      )}
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Gross Income:</span>{" "}
                      <span className="font-medium">{formatCurrency(totalIncome)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Federal Withheld:</span>{" "}
                      <span className="font-medium">{formatCurrency(totalFedWithheld)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">State Withheld:</span>{" "}
                      <span className="font-medium">{formatCurrency(totalStateWithheld)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Documents:</span>{" "}
                      <span className="font-medium">{receivedCount}/{ty.documents.length} received</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })
      )}
    </div>
  );
}

function hasRefundAndReceived(ty: { federalRefund: unknown; stateRefund: unknown; refundReceived: boolean }) {
  return (Number(ty.federalRefund || 0) > 0 || Number(ty.stateRefund || 0) > 0) && ty.refundReceived;
}

function hasRefundNotReceived(ty: { federalRefund: unknown; stateRefund: unknown; refundReceived: boolean }) {
  return (Number(ty.federalRefund || 0) > 0 || Number(ty.stateRefund || 0) > 0) && !ty.refundReceived;
}
