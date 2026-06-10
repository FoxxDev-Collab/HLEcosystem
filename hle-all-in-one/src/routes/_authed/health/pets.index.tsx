import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { PawPrint, Plus, Trash2 } from "lucide-react"
import {
  createPetFn,
  deletePetFn,
  getPetsPageFn,
} from "@/server/health/fns.pets"
import type { PetListRow } from "@/server/health/pets"
import { formatAge } from "@/lib/format"
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
import {
  SPECIES_LABELS,
  SPECIES_OPTIONS,
  formNumOrNull,
  formStr,
  selectClass,
} from "@/components/health/health-shared"

export const Route = createFileRoute("/_authed/health/pets/")({
  loader: () => getPetsPageFn(),
  component: PetsPage,
})

function PetsPage() {
  const pets = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<PetListRow | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pets</h1>
        <p className="text-sm text-muted-foreground">
          Vaccinations, medications, vet visits, and insurance for your pets.
        </p>
      </div>

      <AddPetCard onSaved={() => router.invalidate()} />

      {pets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <PawPrint className="mx-auto mb-4 size-12 opacity-40" />
            <p>No pets yet. Add your first pet above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => {
            const age = formatAge(pet.dateOfBirth)
            return (
              <Card
                key={pet.id}
                className={`h-full transition-colors hover:bg-accent/50 ${
                  !pet.isActive ? "opacity-50" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      <Link
                        to="/health/pets/$id"
                        params={{ id: pet.id }}
                        className="flex items-center gap-2"
                      >
                        <PawPrint className="size-4" />
                        {pet.name}
                      </Link>
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {SPECIES_LABELS[pet.species]}
                      </Badge>
                      {!pet.isActive && (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Delete pet"
                        onClick={() => setDeleteTarget(pet)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link to="/health/pets/$id" params={{ id: pet.id }}>
                    <div className="text-sm text-muted-foreground">
                      {pet.breed && `${pet.breed} · `}
                      {age !== null
                        ? `${age} year${age !== 1 ? "s" : ""} old`
                        : "Age unknown"}
                      {pet.gender && ` · ${pet.gender}`}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {pet.activeMedicationCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {pet.activeMedicationCount} meds
                        </Badge>
                      )}
                      {pet.scheduledAppointmentCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {pet.scheduledAppointmentCount} upcoming
                        </Badge>
                      )}
                      {pet.vaccinationCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {pet.vaccinationCount} vaccines
                        </Badge>
                      )}
                      {pet.ongoingConditionCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {pet.ongoingConditionCount} conditions
                        </Badge>
                      )}
                      {pet.activeInsuranceCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Insured
                        </Badge>
                      )}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <DeletePetDialog
          pet={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function AddPetCard({ onSaved }: { onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const species = formStr(f, "species")
    try {
      const result = await createPetFn({
        data: {
          name: formStr(f, "name"),
          species: SPECIES_OPTIONS.find((s) => s === species) ?? "DOG",
          breed: formStr(f, "breed"),
          color: formStr(f, "color"),
          weightLbs: formNumOrNull(f, "weightLbs"),
          dateOfBirth: formStr(f, "dateOfBirth"),
          gender: formStr(f, "gender"),
          microchipId: formStr(f, "microchipId"),
          adoptionDate: "",
          notes: "",
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
      setError("Could not add pet.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Pet</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="pet-add-name">Name</Label>
            <Input id="pet-add-name" name="name" placeholder="Buddy" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-add-species">Species</Label>
            <select
              id="pet-add-species"
              name="species"
              className={selectClass}
              defaultValue="DOG"
            >
              {SPECIES_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SPECIES_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-add-breed">Breed</Label>
            <Input
              id="pet-add-breed"
              name="breed"
              placeholder="e.g. Golden Retriever"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-add-dob">Date of Birth</Label>
            <Input id="pet-add-dob" name="dateOfBirth" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-add-gender">Gender</Label>
            <select
              id="pet-add-gender"
              name="gender"
              className={selectClass}
              defaultValue=""
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-add-weight">Weight (lbs)</Label>
            <Input
              id="pet-add-weight"
              name="weightLbs"
              type="number"
              step="0.1"
              min="0"
              placeholder="0.0"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-add-color">Color</Label>
            <Input id="pet-add-color" name="color" placeholder="e.g. Golden" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pet-add-chip">Microchip ID</Label>
            <Input
              id="pet-add-chip"
              name="microchipId"
              placeholder="Optional"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="lg:col-span-4">
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Pet"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DeletePetDialog({
  pet,
  onClose,
  onDeleted,
}: {
  pet: PetListRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

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

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
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
