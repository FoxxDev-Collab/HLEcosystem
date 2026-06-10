import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { PetConditionRow } from "@/server/health/pets"
import {
  addPetConditionFn,
  deletePetConditionFn,
  resolvePetConditionFn,
} from "@/server/health/fns.pets"
import { formatDate } from "@/lib/format"
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
import { formStr, selectClass } from "./health-shared"

export function PetConditionsTab({
  petId,
  conditions,
  onChanged,
}: {
  petId: string
  conditions: Array<PetConditionRow>
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
      const result = await addPetConditionFn({
        data: {
          petId,
          conditionName: formStr(f, "conditionName"),
          diagnosedDate: formStr(f, "diagnosedDate"),
          isOngoing: formStr(f, "isOngoing") !== "false",
          severity: formStr(f, "severity"),
          treatment: formStr(f, "treatment"),
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
      setError("Could not add condition.")
    }
    setPending(false)
  }

  async function resolve(id: string) {
    setError(null)
    try {
      const result = await resolvePetConditionFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not resolve condition.")
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      const result = await deletePetConditionFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        onChanged()
      }
    } catch {
      setError("Could not delete condition.")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSubmit}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="pcond-name">Condition Name</Label>
              <Input
                id="pcond-name"
                name="conditionName"
                placeholder="e.g. Hip Dysplasia"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pcond-date">Diagnosed Date</Label>
              <Input id="pcond-date" name="diagnosedDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pcond-severity">Severity</Label>
              <select
                id="pcond-severity"
                name="severity"
                className={selectClass}
                defaultValue=""
              >
                <option value="">Select</option>
                <option value="Mild">Mild</option>
                <option value="Moderate">Moderate</option>
                <option value="Severe">Severe</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pcond-ongoing">Ongoing</Label>
              <select
                id="pcond-ongoing"
                name="isOngoing"
                className={selectClass}
                defaultValue="true"
              >
                <option value="true">Yes</option>
                <option value="false">Resolved</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pcond-treatment">Treatment</Label>
              <Input
                id="pcond-treatment"
                name="treatment"
                placeholder="e.g. Joint supplements, controlled exercise"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pcond-notes">Notes</Label>
              <Input id="pcond-notes" name="notes" />
            </div>
            {error && (
              <p className="text-sm text-destructive lg:col-span-4">{error}</p>
            )}
            <Button type="submit" disabled={pending} className="lg:col-span-4">
              <Plus className="size-4" />
              {pending ? "Adding…" : "Add Condition"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Health Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          {conditions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No conditions recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Condition</TableHead>
                  <TableHead>Diagnosed</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {conditions.map((c) => (
                  <TableRow
                    key={c.id}
                    className={!c.isOngoing ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      {c.conditionName}
                    </TableCell>
                    <TableCell>{formatDate(c.diagnosedDate)}</TableCell>
                    <TableCell>{c.severity || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={c.isOngoing ? "destructive" : "secondary"}
                      >
                        {c.isOngoing ? "Ongoing" : "Resolved"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {c.treatment || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.isOngoing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => resolve(c.id)}
                          >
                            Resolve
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Delete condition"
                          onClick={() => remove(c.id)}
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
