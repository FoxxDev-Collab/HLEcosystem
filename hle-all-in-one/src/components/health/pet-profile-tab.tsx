import { useState } from "react"
import { Trash2 } from "lucide-react"
import type { PetRow } from "@/server/health/pets"
import { deletePetFn, updatePetFn } from "@/server/health/fns.pets"
import { formatAge, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  SPECIES_LABELS,
  SPECIES_OPTIONS,
  formNumOrNull,
  formStr,
  selectClass,
} from "./health-shared"

export function PetProfileTab({
  pet,
  onChanged,
  onDeleted,
}: {
  pet: PetRow
  onChanged: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await updatePetFn({
        data: {
          id: pet.id,
          name: formStr(f, "name"),
          species: formStr(f, "species") as PetRow["species"],
          breed: formStr(f, "breed"),
          color: formStr(f, "color"),
          weightLbs: formNumOrNull(f, "weightLbs"),
          dateOfBirth: formStr(f, "dateOfBirth"),
          gender: formStr(f, "gender"),
          microchipId: formStr(f, "microchipId"),
          adoptionDate: formStr(f, "adoptionDate"),
          notes: formStr(f, "notes"),
          isActive: formStr(f, "isActive") !== "false",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
      } else {
        setSaved(true)
        onChanged()
      }
    } catch {
      setError("Could not save pet.")
    }
    setPending(false)
  }

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deletePetFn({ data: { id: pet.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete pet.")
      setPending(false)
    }
  }

  const age = formatAge(pet.dateOfBirth)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pet Profile</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Delete Pet
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-1">
            <Label htmlFor="pet-name">Name</Label>
            <Input id="pet-name" name="name" defaultValue={pet.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-species">Species</Label>
            <select
              id="pet-species"
              name="species"
              className={selectClass}
              defaultValue={pet.species}
            >
              {SPECIES_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SPECIES_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-breed">Breed</Label>
            <Input id="pet-breed" name="breed" defaultValue={pet.breed ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-color">Color</Label>
            <Input id="pet-color" name="color" defaultValue={pet.color ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-weight">Weight (lbs)</Label>
            <Input
              id="pet-weight"
              name="weightLbs"
              type="number"
              step="0.1"
              min="0"
              defaultValue={pet.weightLbs ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-dob">Date of Birth</Label>
            <Input
              id="pet-dob"
              name="dateOfBirth"
              type="date"
              defaultValue={pet.dateOfBirth ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-gender">Gender</Label>
            <select
              id="pet-gender"
              name="gender"
              className={selectClass}
              defaultValue={pet.gender ?? ""}
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-chip">Microchip ID</Label>
            <Input
              id="pet-chip"
              name="microchipId"
              defaultValue={pet.microchipId ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-adoption">Adoption Date</Label>
            <Input
              id="pet-adoption"
              name="adoptionDate"
              type="date"
              defaultValue={pet.adoptionDate ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-status">Status</Label>
            <select
              id="pet-status"
              name="isActive"
              className={selectClass}
              defaultValue={pet.isActive ? "true" : "false"}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="pet-notes">Notes</Label>
            <Textarea
              id="pet-notes"
              name="notes"
              defaultValue={pet.notes ?? ""}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              Saved.
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="sm:col-span-2 lg:col-span-3"
          >
            {pending ? "Saving…" : "Save Changes"}
          </Button>
        </form>

        <div className="mt-6 grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Age: </span>
            <span className="font-medium">
              {age !== null ? `${age} year${age !== 1 ? "s" : ""}` : "Unknown"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Status: </span>
            <Badge variant={pet.isActive ? "default" : "secondary"}>
              {pet.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Added: </span>
            <span className="font-medium">{formatDate(pet.createdAt)}</span>
          </div>
        </div>
      </CardContent>

      {confirmDelete && (
        <AlertDialog open onOpenChange={(o) => !o && setConfirmDelete(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {pet.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                All vaccinations, medications, appointments, conditions, and
                insurance records for this pet are deleted with it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDelete(false)}>
                Cancel
              </AlertDialogCancel>
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
      )}
    </Card>
  )
}
