import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { Award, ExternalLink, Plus, Trash2 } from "lucide-react"
import {
  createCertificationFn,
  deleteCertificationFn,
  getCertificationsPageFn,
} from "@/server/hub/fns.education"
import type {
  CertificationStatus,
  CertificationWithMemberRow,
} from "@/server/hub/education"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authed/hub/education/certifications")({
  loader: () => getCertificationsPageFn(),
  component: CertificationsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const CERT_STATUSES: Array<{ value: CertificationStatus; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "PENDING", label: "Pending" },
  { value: "REVOKED", label: "Revoked" },
]

const STATUS_COLORS: Record<CertificationStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  EXPIRED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  PENDING:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  REVOKED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

function statusLabel(status: CertificationStatus): string {
  return CERT_STATUSES.find((s) => s.value === status)?.label ?? status
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  return Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000)
}

function ExpiryBadge({ expirationDate }: { expirationDate: string | null }) {
  if (!expirationDate) return null
  const days = daysUntil(expirationDate)
  if (days <= 0) {
    return (
      <Badge className="bg-red-100 text-[9px] text-red-700 dark:bg-red-900 dark:text-red-300">
        Expired
      </Badge>
    )
  }
  const color =
    days < 30
      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
      : days < 90
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
        : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
  return <Badge className={`text-[9px] ${color}`}>{days}d left</Badge>
}

function str(f: FormData, key: string): string | null {
  const v = f.get(key)
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function num(f: FormData, key: string): number | null {
  const v = f.get(key)
  if (typeof v !== "string" || !v.trim()) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function CertificationsPage() {
  const { members, certifications } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    label: string
  } | null>(null)

  function refresh() {
    router.invalidate()
  }

  const activeCerts = certifications.filter((c) => c.status === "ACTIVE")
  const otherCerts = certifications.filter((c) => c.status !== "ACTIVE")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Certifications</h1>
        <p className="text-sm text-muted-foreground">
          {certifications.length} certification
          {certifications.length !== 1 ? "s" : ""} tracked across the family.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: certification list */}
        <div className="space-y-4">
          {certifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Award className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No certifications tracked yet. Add one using the form.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {activeCerts.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Award className="size-4 text-green-600" />
                    Active ({activeCerts.length})
                  </h2>
                  <div className="space-y-2">
                    {activeCerts.map((cert) => (
                      <CertificationCard
                        key={cert.id}
                        cert={cert}
                        showExpiry
                        onDelete={() =>
                          setDeleteTarget({ id: cert.id, label: cert.name })
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {otherCerts.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    Other ({otherCerts.length})
                  </h2>
                  <div className="space-y-2">
                    {otherCerts.map((cert) => (
                      <CertificationCard
                        key={cert.id}
                        cert={cert}
                        dimmed
                        onDelete={() =>
                          setDeleteTarget({ id: cert.id, label: cert.name })
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Right: add form */}
        <div>
          <AddCertificationForm members={members} onSaved={refresh} />
        </div>
      </div>

      {deleteTarget && (
        <DeleteCertificationDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function CertificationCard({
  cert,
  showExpiry = false,
  dimmed = false,
  onDelete,
}: {
  cert: CertificationWithMemberRow
  showExpiry?: boolean
  dimmed?: boolean
  onDelete: () => void
}) {
  return (
    <Card className={dimmed ? "opacity-70" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-semibold">{cert.name}</p>
              {showExpiry ? (
                <ExpiryBadge expirationDate={cert.expirationDate} />
              ) : (
                <Badge className={`text-[9px] ${STATUS_COLORS[cert.status]}`}>
                  {statusLabel(cert.status)}
                </Badge>
              )}
            </div>
            <Link
              to="/hub/education/$memberId"
              params={{ memberId: cert.familyMemberId }}
              className="text-xs text-primary hover:underline"
            >
              {cert.firstName} {cert.lastName}
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
            <div className="mt-1 flex items-center gap-3">
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
              {cert.renewalCost !== null && (
                <p className="text-[10px] text-muted-foreground">
                  Renewal: {formatCurrency(cert.renewalCost)}
                </p>
              )}
            </div>
            {cert.url && (
              <a
                href={cert.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex items-center gap-0.5 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="size-2.5" />
                View credential
              </a>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Delete certification"
            onClick={onDelete}
          >
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AddCertificationForm({
  members,
  onSaved,
}: {
  members: Array<{ id: string; firstName: string; lastName: string }>
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createCertificationFn({
        data: {
          familyMemberId: String(f.get("familyMemberId") ?? ""),
          name: String(f.get("name") ?? ""),
          issuingBody: str(f, "issuingBody"),
          credentialId: str(f, "credentialId"),
          issueDate: str(f, "issueDate"),
          expirationDate: str(f, "expirationDate"),
          status: String(f.get("status") ?? "ACTIVE") as CertificationStatus,
          renewalCost: num(f, "renewalCost"),
          url: str(f, "url"),
          notes: str(f, "notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setPending(false)
      onSaved()
    } catch {
      setError("Could not add certification.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="size-4" />
          Add Certification
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="nc-member">Family Member *</Label>
            <select
              id="nc-member"
              name="familyMemberId"
              required
              className={selectClass}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-name">Certification Name *</Label>
            <Input id="nc-name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="nc-issuingBody">Issuing Body</Label>
              <Input id="nc-issuingBody" name="issuingBody" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-credentialId">Credential ID</Label>
              <Input id="nc-credentialId" name="credentialId" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="nc-issueDate">Issue Date</Label>
              <Input id="nc-issueDate" name="issueDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-expirationDate">Expiration Date</Label>
              <Input id="nc-expirationDate" name="expirationDate" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="nc-status">Status</Label>
              <select
                id="nc-status"
                name="status"
                className={selectClass}
                defaultValue="ACTIVE"
              >
                {CERT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-renewalCost">Renewal Cost</Label>
              <Input
                id="nc-renewalCost"
                name="renewalCost"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-url">URL</Label>
            <Input
              id="nc-url"
              name="url"
              type="url"
              placeholder="https://..."
            />
          </div>
          <Textarea name="notes" placeholder="Notes" rows={2} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Certification"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteCertificationDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: { id: string; label: string }
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteCertificationFn({ data: { id: target.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete certification.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {target.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This certification is removed permanently.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
