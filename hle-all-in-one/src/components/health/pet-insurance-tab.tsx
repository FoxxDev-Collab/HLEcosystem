import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { PetInsuranceRow, PetInsuranceType } from "@/server/health/pets"
import {
  addPetInsuranceFn,
  deletePetInsuranceFn,
} from "@/server/health/fns.pets"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formIntOrNull,
  formNumOrNull,
  formStr,
  isDateOverdue,
  selectClass,
} from "./health-shared"

const INSURANCE_TYPES: Array<PetInsuranceType> = [
  "ACCIDENT_ONLY",
  "ACCIDENT_AND_ILLNESS",
  "WELLNESS",
  "COMPREHENSIVE",
  "OTHER",
]

export function PetInsuranceTab({
  petId,
  insurances,
  onChanged,
}: {
  petId: string
  insurances: Array<PetInsuranceRow>
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const type = formStr(f, "insuranceType")
    try {
      const result = await addPetInsuranceFn({
        data: {
          petId,
          providerName: formStr(f, "providerName"),
          policyNumber: formStr(f, "policyNumber"),
          insuranceType:
            INSURANCE_TYPES.find((t) => t === type) ?? "COMPREHENSIVE",
          monthlyPremium: formNumOrNull(f, "monthlyPremium"),
          deductible: formNumOrNull(f, "deductible"),
          annualLimit: formNumOrNull(f, "annualLimit"),
          reimbursementPct: formIntOrNull(f, "reimbursementPct"),
          effectiveDate: formStr(f, "effectiveDate"),
          expirationDate: formStr(f, "expirationDate"),
          phoneNumber: formStr(f, "phoneNumber"),
          website: formStr(f, "website"),
          notes: formStr(f, "notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        form.reset()
        onChanged()
      }
    } catch {
      setError("Could not add insurance policy.")
    }
    setPending(false)
  }

  async function remove(id: string) {
    setError(null)
    try {
      const result = await deletePetInsuranceFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not delete insurance policy.")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Insurance Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSubmit}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="pins-provider">Provider Name</Label>
              <Input
                id="pins-provider"
                name="providerName"
                placeholder="e.g. Trupanion"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-policy">Policy Number</Label>
              <Input
                id="pins-policy"
                name="policyNumber"
                placeholder="POL-12345"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-type">Type</Label>
              <select
                id="pins-type"
                name="insuranceType"
                className={selectClass}
                defaultValue="COMPREHENSIVE"
              >
                {INSURANCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-premium">Monthly Premium</Label>
              <Input
                id="pins-premium"
                name="monthlyPremium"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-deductible">Deductible</Label>
              <Input
                id="pins-deductible"
                name="deductible"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-limit">Annual Limit</Label>
              <Input
                id="pins-limit"
                name="annualLimit"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-reimb">Reimbursement %</Label>
              <Input
                id="pins-reimb"
                name="reimbursementPct"
                type="number"
                min="0"
                max="100"
                placeholder="80"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-phone">Phone</Label>
              <Input id="pins-phone" name="phoneNumber" type="tel" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-effective">Effective Date</Label>
              <Input id="pins-effective" name="effectiveDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-expiration">Expiration Date</Label>
              <Input id="pins-expiration" name="expirationDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-website">Website</Label>
              <Input
                id="pins-website"
                name="website"
                type="url"
                placeholder="https://"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pins-notes">Notes</Label>
              <Input id="pins-notes" name="notes" />
            </div>
            {error && (
              <p className="text-sm text-destructive lg:col-span-4">{error}</p>
            )}
            <Button type="submit" disabled={pending} className="lg:col-span-4">
              <Plus className="size-4" />
              {pending ? "Adding…" : "Add Policy"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insurance Policies</CardTitle>
        </CardHeader>
        <CardContent>
          {insurances.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No insurance policies recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Policy #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Deductible</TableHead>
                  <TableHead>Reimb.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {insurances.map((i) => {
                  const isExpired = isDateOverdue(i.expirationDate)
                  return (
                    <TableRow
                      key={i.id}
                      className={!i.isActive || isExpired ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium">
                        {i.providerName}
                      </TableCell>
                      <TableCell>{i.policyNumber}</TableCell>
                      <TableCell>
                        {i.insuranceType.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        {i.monthlyPremium !== null
                          ? `${formatCurrency(i.monthlyPremium)}/mo`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {i.deductible !== null
                          ? formatCurrency(i.deductible)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {i.reimbursementPct !== null
                          ? `${i.reimbursementPct}%`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge variant={i.isActive ? "default" : "secondary"}>
                            {i.isActive ? "Active" : "Inactive"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Delete policy"
                          onClick={() => remove(i.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
