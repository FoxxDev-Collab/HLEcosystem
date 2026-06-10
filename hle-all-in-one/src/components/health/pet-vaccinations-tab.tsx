import { useState } from "react"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import type { PetVaccinationRow, VetProviderRow } from "@/server/health/pets"
import {
  addPetVaccinationFn,
  deletePetVaccinationFn,
} from "@/server/health/fns.pets"
import { formatDate } from "@/lib/format"
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
import { formStr, isDateOverdue, selectClass } from "./health-shared"

export function PetVaccinationsTab({
  petId,
  vaccinations,
  vetProviders,
  onChanged,
}: {
  petId: string
  vaccinations: Array<PetVaccinationRow>
  vetProviders: Array<VetProviderRow>
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
      const result = await addPetVaccinationFn({
        data: {
          petId,
          vaccineName: formStr(f, "vaccineName"),
          doseNumber: formStr(f, "doseNumber"),
          dateAdministered: formStr(f, "dateAdministered"),
          nextDueDate: formStr(f, "nextDueDate"),
          administeredBy: formStr(f, "administeredBy"),
          providerId: formStr(f, "providerId"),
          lotNumber: formStr(f, "lotNumber"),
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
      setError("Could not add vaccination.")
    }
    setPending(false)
  }

  async function remove(id: string) {
    setError(null)
    try {
      const result = await deletePetVaccinationFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not delete vaccination.")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Vaccination</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSubmit}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="vac-name">Vaccine Name</Label>
              <Input
                id="vac-name"
                name="vaccineName"
                placeholder="e.g. Rabies"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vac-date">Date Administered</Label>
              <Input
                id="vac-date"
                name="dateAdministered"
                type="date"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vac-next">Next Due Date</Label>
              <Input id="vac-next" name="nextDueDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vac-dose">Dose #</Label>
              <Input
                id="vac-dose"
                name="doseNumber"
                placeholder="e.g. 1 of 3"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vac-by">Administered By</Label>
              <Input id="vac-by" name="administeredBy" placeholder="Vet name" />
            </div>
            {vetProviders.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="vac-provider">Provider</Label>
                <select
                  id="vac-provider"
                  name="providerId"
                  className={selectClass}
                  defaultValue=""
                >
                  <option value="">Select provider</option>
                  {vetProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="vac-lot">Lot Number</Label>
              <Input id="vac-lot" name="lotNumber" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vac-notes">Notes</Label>
              <Input id="vac-notes" name="notes" />
            </div>
            {error && (
              <p className="text-sm text-destructive lg:col-span-4">{error}</p>
            )}
            <Button type="submit" disabled={pending} className="lg:col-span-4">
              <Plus className="size-4" />
              {pending ? "Adding…" : "Add Vaccination"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vaccination History</CardTitle>
        </CardHeader>
        <CardContent>
          {vaccinations.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No vaccinations recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vaccine</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vaccinations.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      {v.vaccineName}
                    </TableCell>
                    <TableCell>{formatDate(v.dateAdministered)}</TableCell>
                    <TableCell>{v.doseNumber || "—"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {formatDate(v.nextDueDate)}
                        {isDateOverdue(v.nextDueDate) && (
                          <AlertTriangle className="size-3.5 text-amber-500" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {v.providerName || v.administeredBy || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Delete vaccination"
                        onClick={() => remove(v.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
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
