import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ExternalLink, Plus, Shield, Trash2, Users } from "lucide-react"
import {
  createInsurancePolicyFn,
  deletePolicyFn,
  getInsurancePageFn,
  togglePolicyActiveFn,
  updatePolicyCoverageFn,
} from "@/server/health/fns.insurance"
import type {
  InsurancePolicyRow,
  InsuranceType,
  PolicyCoverageRow,
} from "@/server/health/insurance"
import type { HealthMemberOption } from "@/server/health/medications"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export const Route = createFileRoute("/_authed/health/insurance")({
  loader: () => getInsurancePageFn(),
  component: InsurancePage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const INSURANCE_TYPES: Array<InsuranceType> = [
  "MEDICAL",
  "DENTAL",
  "VISION",
  "PRESCRIPTION",
  "SUPPLEMENTAL",
  "OTHER",
]

function InsurancePage() {
  const { members, policies, coverage } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<InsurancePolicyRow | null>(
    null
  )

  function refresh() {
    router.invalidate()
  }

  async function onToggleActive(id: string) {
    await togglePolicyActiveFn({ data: { id } })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Insurance Policies</h1>
        <p className="text-sm text-muted-foreground">
          Manage household policies and assign covered family members. One
          policy can cover the whole family.
        </p>
      </div>

      <AddPolicyCard members={members} onSaved={refresh} />

      {policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="mx-auto mb-3 size-10 opacity-40" />
            <p>No insurance policies yet. Add your first policy above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              members={members}
              coverage={coverage.filter((c) => c.policyId === policy.id)}
              onToggleActive={() => onToggleActive(policy.id)}
              onDelete={() => setDeleteTarget(policy)}
              onSaved={refresh}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeletePolicyDialog
          policy={deleteTarget}
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

function PolicyCard({
  policy,
  members,
  coverage,
  onToggleActive,
  onDelete,
  onSaved,
}: {
  policy: InsurancePolicyRow
  members: Array<HealthMemberOption>
  coverage: Array<PolicyCoverageRow>
  onToggleActive: () => void
  onDelete: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const coveredIds = new Set(coverage.map((c) => c.memberId))

  async function onUpdateCoverage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await updatePolicyCoverageFn({
        data: {
          policyId: policy.id,
          coveredMemberIds: f.getAll("coveredMemberIds").map(String),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      setPending(false)
      onSaved()
    } catch {
      setError("Could not update coverage.")
      setPending(false)
    }
  }

  return (
    <Card className={!policy.isActive ? "opacity-50" : ""}>
      <CardContent className="py-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">
                  {policy.providerName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {policy.insuranceType}
                </Badge>
                {!policy.isActive && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                <div>
                  Policy: {policy.policyNumber}
                  {policy.groupNumber && <> · Group: {policy.groupNumber}</>}
                  {policy.policyHolderName && (
                    <> · Holder: {policy.policyHolderName}</>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {policy.deductible !== null && (
                    <span>Deductible: {formatCurrency(policy.deductible)}</span>
                  )}
                  {policy.outOfPocketMax !== null && (
                    <span>
                      OOP Max: {formatCurrency(policy.outOfPocketMax)}
                    </span>
                  )}
                  {policy.copay !== null && (
                    <span>Copay: {formatCurrency(policy.copay)}</span>
                  )}
                </div>
                {(policy.effectiveDate || policy.expirationDate) && (
                  <div>
                    {policy.effectiveDate && (
                      <>Effective: {formatDate(policy.effectiveDate)}</>
                    )}
                    {policy.expirationDate && (
                      <> · Expires: {formatDate(policy.expirationDate)}</>
                    )}
                  </div>
                )}
                {policy.phoneNumber && <div>Phone: {policy.phoneNumber}</div>}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {policy.website && (
                <a
                  href={policy.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Open website"
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                </a>
              )}
              <Button variant="outline" size="sm" onClick={onToggleActive}>
                {policy.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Delete"
                onClick={onDelete}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <form onSubmit={onUpdateCoverage} className="space-y-2">
              <div className="mb-2 flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Covered Members ({coverage.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input
                      type="checkbox"
                      name="coveredMemberIds"
                      value={m.id}
                      defaultChecked={coveredIds.has(m.id)}
                      className="size-3.5 accent-primary"
                    />
                    {m.firstName}
                  </label>
                ))}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={pending}
              >
                {pending ? "Updating…" : "Update Coverage"}
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AddPolicyCard({
  members,
  onSaved,
}: {
  members: Array<HealthMemberOption>
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
      const result = await createInsurancePolicyFn({
        data: {
          providerName: String(f.get("providerName") ?? ""),
          policyNumber: String(f.get("policyNumber") ?? ""),
          groupNumber: String(f.get("groupNumber") ?? ""),
          policyHolderName: String(f.get("policyHolderName") ?? ""),
          insuranceType: String(
            f.get("insuranceType") ?? "MEDICAL"
          ) as InsuranceType,
          phoneNumber: String(f.get("phoneNumber") ?? ""),
          website: String(f.get("website") ?? ""),
          effectiveDate: String(f.get("effectiveDate") ?? ""),
          expirationDate: String(f.get("expirationDate") ?? ""),
          deductible: f.get("deductible") ? Number(f.get("deductible")) : null,
          outOfPocketMax: f.get("outOfPocketMax")
            ? Number(f.get("outOfPocketMax"))
            : null,
          copay: f.get("copay") ? Number(f.get("copay")) : null,
          coveredMemberIds: f.getAll("coveredMemberIds").map(String),
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
      setError("Could not add policy.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="size-4" /> Add Policy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="pol-provider">Insurance Provider</Label>
              <Input
                id="pol-provider"
                name="providerName"
                placeholder="e.g. Blue Cross"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-number">Policy Number</Label>
              <Input id="pol-number" name="policyNumber" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-type">Type</Label>
              <select
                id="pol-type"
                name="insuranceType"
                className={selectClass}
                defaultValue="MEDICAL"
              >
                {INSURANCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-group">Group #</Label>
              <Input id="pol-group" name="groupNumber" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-holder">Policy Holder Name</Label>
              <Input id="pol-holder" name="policyHolderName" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-deductible">Deductible</Label>
              <Input
                id="pol-deductible"
                name="deductible"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-oopMax">Out-of-Pocket Max</Label>
              <Input
                id="pol-oopMax"
                name="outOfPocketMax"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-copay">Copay</Label>
              <Input
                id="pol-copay"
                name="copay"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-effective">Effective Date</Label>
              <Input id="pol-effective" name="effectiveDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-expiration">Expiration Date</Label>
              <Input id="pol-expiration" name="expirationDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-phone">Phone</Label>
              <Input id="pol-phone" name="phoneNumber" type="tel" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-website">Website</Label>
              <Input id="pol-website" name="website" type="url" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Users className="size-4" /> Covered Family Members
            </Label>
            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input
                    type="checkbox"
                    name="coveredMemberIds"
                    value={m.id}
                    defaultChecked
                    className="size-4 accent-primary"
                  />
                  {m.firstName} {m.lastName}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select all family members covered under this policy.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Policy"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DeletePolicyDialog({
  policy,
  onClose,
  onDeleted,
}: {
  policy: InsurancePolicyRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deletePolicyFn({ data: { id: policy.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete policy.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {policy.providerName} policy?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The policy and its member coverage assignments will be permanently
            removed.
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
