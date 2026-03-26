import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatCurrency } from "@/lib/format";
import { Award, Plus, Trash2, ExternalLink } from "lucide-react";
import {
  addCertificationAction,
  deleteCertificationAction,
} from "../actions";

const CERT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "PENDING", label: "Pending" },
  { value: "REVOKED", label: "Revoked" },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  EXPIRED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  REVOKED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function getExpiryBadge(expirationDate: Date | null) {
  if (!expirationDate) return null;
  const now = new Date();
  const expiry = new Date(expirationDate);
  const daysUntil = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil <= 0) {
    return (
      <Badge className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
        Expired
      </Badge>
    );
  } else if (daysUntil < 30) {
    return (
      <Badge className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
        {daysUntil}d left
      </Badge>
    );
  } else if (daysUntil < 90) {
    return (
      <Badge className="text-[9px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
        {daysUntil}d left
      </Badge>
    );
  } else {
    return (
      <Badge className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        {daysUntil}d left
      </Badge>
    );
  }
}

export default async function CertificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const members = await prisma.familyMember.findMany({
    where: { householdId, isActive: true },
    orderBy: { firstName: "asc" },
  });

  const certifications = await prisma.certification.findMany({
    where: { householdId },
    include: {
      familyMember: { select: { firstName: true, lastName: true, id: true } },
    },
    orderBy: [{ status: "asc" }, { expirationDate: "asc" }],
  });

  const activeCerts = certifications.filter((c) => c.status === "ACTIVE");
  const otherCerts = certifications.filter((c) => c.status !== "ACTIVE");

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certifications</h1>
        <p className="text-muted-foreground text-sm">
          {certifications.length} certification
          {certifications.length !== 1 ? "s" : ""} tracked across the family.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: certification list */}
        <div className="space-y-4">
          {certifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Award className="size-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No certifications tracked yet. Add one using the form.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Active certifications */}
              {activeCerts.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Award className="size-4 text-green-600" />
                    Active ({activeCerts.length})
                  </h2>
                  <div className="space-y-2">
                    {activeCerts.map((cert) => (
                      <Card key={cert.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold">
                                  {cert.name}
                                </p>
                                {getExpiryBadge(cert.expirationDate)}
                              </div>
                              <Link
                                href={`/education/${cert.familyMember.id}`}
                                className="text-xs text-primary hover:underline"
                              >
                                {cert.familyMember.firstName}{" "}
                                {cert.familyMember.lastName}
                              </Link>
                              {cert.issuingBody && (
                                <p className="text-xs text-muted-foreground">
                                  {cert.issuingBody}
                                </p>
                              )}
                              {cert.credentialId && (
                                <p className="text-[10px] text-muted-foreground">
                                  ID: {cert.credentialId}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                {cert.issueDate && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Issued: {formatDate(cert.issueDate)}
                                  </p>
                                )}
                                {cert.expirationDate && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Expires: {formatDate(cert.expirationDate)}
                                  </p>
                                )}
                                {cert.renewalCost && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Renewal:{" "}
                                    {formatCurrency(cert.renewalCost.toString())}
                                  </p>
                                )}
                              </div>
                              {cert.url && (
                                <a
                                  href={cert.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5"
                                >
                                  <ExternalLink className="size-2.5" />
                                  View credential
                                </a>
                              )}
                            </div>
                            <form action={deleteCertificationAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={cert.id}
                              />
                              <input
                                type="hidden"
                                name="familyMemberId"
                                value={cert.familyMemberId}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] text-destructive"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </form>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* Other certifications */}
              {otherCerts.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                    Other ({otherCerts.length})
                  </h2>
                  <div className="space-y-2">
                    {otherCerts.map((cert) => (
                      <Card key={cert.id} className="opacity-70">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold">
                                  {cert.name}
                                </p>
                                <Badge
                                  className={`text-[9px] ${STATUS_COLORS[cert.status] ?? STATUS_COLORS.REVOKED}`}
                                >
                                  {CERT_STATUSES.find(
                                    (s) => s.value === cert.status
                                  )?.label ?? cert.status}
                                </Badge>
                              </div>
                              <Link
                                href={`/education/${cert.familyMember.id}`}
                                className="text-xs text-primary hover:underline"
                              >
                                {cert.familyMember.firstName}{" "}
                                {cert.familyMember.lastName}
                              </Link>
                              {cert.issuingBody && (
                                <p className="text-xs text-muted-foreground">
                                  {cert.issuingBody}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                {cert.issueDate && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Issued: {formatDate(cert.issueDate)}
                                  </p>
                                )}
                                {cert.expirationDate && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Expires: {formatDate(cert.expirationDate)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <form action={deleteCertificationAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={cert.id}
                              />
                              <input
                                type="hidden"
                                name="familyMemberId"
                                value={cert.familyMemberId}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] text-destructive"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </form>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Right: add form */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Plus className="size-4" />
                Add Certification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addCertificationAction} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Family Member *</Label>
                  <select
                    name="familyMemberId"
                    required
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Certification Name *</Label>
                  <Input name="name" required className="h-8 text-sm" />
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Issuing Body</Label>
                    <Input name="issuingBody" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Credential ID</Label>
                    <Input name="credentialId" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Issue Date</Label>
                    <Input
                      name="issueDate"
                      type="date"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Expiration Date</Label>
                    <Input
                      name="expirationDate"
                      type="date"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <select
                      name="status"
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {CERT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Renewal Cost</Label>
                    <Input
                      name="renewalCost"
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    name="url"
                    type="url"
                    placeholder="https://..."
                    className="h-8 text-sm"
                  />
                </div>
                <Textarea
                  name="notes"
                  placeholder="Notes"
                  rows={2}
                  className="text-sm"
                />
                <Button type="submit" className="w-full h-9">
                  <Plus className="size-4 mr-1.5" />
                  Add Certification
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
