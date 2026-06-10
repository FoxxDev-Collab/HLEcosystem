import { useState } from "react"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import type { PetMedicationRow } from "@/server/health/pets"
import {
  addPetMedicationFn,
  deactivatePetMedicationFn,
  deletePetMedicationFn,
} from "@/server/health/fns.pets"
import { formatCurrency, formatDate } from "@/lib/format"
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
import { formNumOrNull, formStr, isDateOverdue } from "./health-shared"

export function PetMedicationsTab({
  petId,
  medications,
  onChanged,
}: {
  petId: string
  medications: Array<PetMedicationRow>
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
    try {
      const result = await addPetMedicationFn({
        data: {
          petId,
          medicationName: formStr(f, "medicationName"),
          dosage: formStr(f, "dosage"),
          frequency: formStr(f, "frequency"),
          startDate: formStr(f, "startDate"),
          endDate: "",
          prescribedBy: formStr(f, "prescribedBy"),
          pharmacy: "",
          nextRefillDate: formStr(f, "nextRefillDate"),
          purpose: formStr(f, "purpose"),
          costPerRefill: formNumOrNull(f, "costPerRefill"),
          notes: "",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        form.reset()
        onChanged()
      }
    } catch {
      setError("Could not add medication.")
    }
    setPending(false)
  }

  async function deactivate(id: string) {
    setError(null)
    try {
      const result = await deactivatePetMedicationFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not deactivate medication.")
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      const result = await deletePetMedicationFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not delete medication.")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Medication</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSubmit}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="pmed-name">Medication Name</Label>
              <Input
                id="pmed-name"
                name="medicationName"
                placeholder="e.g. Heartgard"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmed-dosage">Dosage</Label>
              <Input
                id="pmed-dosage"
                name="dosage"
                placeholder="e.g. 1 tablet"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmed-frequency">Frequency</Label>
              <Input
                id="pmed-frequency"
                name="frequency"
                placeholder="e.g. Monthly"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmed-purpose">Purpose</Label>
              <Input
                id="pmed-purpose"
                name="purpose"
                placeholder="e.g. Heartworm prevention"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmed-start">Start Date</Label>
              <Input id="pmed-start" name="startDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmed-refill">Next Refill</Label>
              <Input id="pmed-refill" name="nextRefillDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmed-cost">Cost per Refill</Label>
              <Input
                id="pmed-cost"
                name="costPerRefill"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmed-by">Prescribed By</Label>
              <Input id="pmed-by" name="prescribedBy" />
            </div>
            {error && (
              <p className="text-sm text-destructive lg:col-span-4">{error}</p>
            )}
            <Button type="submit" disabled={pending} className="lg:col-span-4">
              <Plus className="size-4" />
              {pending ? "Adding…" : "Add Medication"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medications</CardTitle>
        </CardHeader>
        <CardContent>
          {medications.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No medications recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medication</TableHead>
                  <TableHead>Dosage</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Refill Due</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {medications.map((m) => (
                  <TableRow
                    key={m.id}
                    className={!m.isActive ? "opacity-50" : ""}
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium">{m.medicationName}</span>
                        {m.purpose && (
                          <div className="text-xs text-muted-foreground">
                            {m.purpose}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{m.dosage || "—"}</TableCell>
                    <TableCell>{m.frequency || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? "default" : "secondary"}>
                        {m.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {formatDate(m.nextRefillDate)}
                        {isDateOverdue(m.nextRefillDate) && m.isActive && (
                          <AlertTriangle className="size-3.5 text-amber-500" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {m.costPerRefill !== null
                        ? formatCurrency(m.costPerRefill)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {m.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => deactivate(m.id)}
                          >
                            Deactivate
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Delete medication"
                          onClick={() => remove(m.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
