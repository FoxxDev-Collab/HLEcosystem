import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { HardHat, Plus, Star, Trash2 } from "lucide-react"
import {
  createProviderFn,
  deleteProviderFn,
  getProvidersPageFn,
} from "@/server/home-care/fns.providers"
import type {
  ProviderRow,
  ProviderSpecialty,
} from "@/server/home-care/providers"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/home-care/providers")({
  loader: () => getProvidersPageFn(),
  component: ProvidersPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const SPECIALTIES: Array<ProviderSpecialty> = [
  "HVAC",
  "PLUMBING",
  "ELECTRICAL",
  "APPLIANCE_REPAIR",
  "GENERAL_CONTRACTOR",
  "LANDSCAPING",
  "PEST_CONTROL",
  "ROOFING",
  "PAINTING",
  "FLOORING",
  "AUTO_MECHANIC",
  "AUTO_BODY",
  "AUTO_DEALER",
  "CLEANING",
  "LOCKSMITH",
  "HANDYMAN",
  "OTHER",
]

function ProvidersPage() {
  const providers = Route.useLoaderData()
  const router = useRouter()
  const [createError, setCreateError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProviderRow | null>(null)

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const text = (name: string) => String(f.get(name) ?? "")
    try {
      const result = await createProviderFn({
        data: {
          name: text("name"),
          company: text("company"),
          specialty: text("specialty") as ProviderSpecialty,
          phone: text("phone"),
          email: text("email"),
          website: "",
          address: "",
          rating: text("rating"),
          notes: text("notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setCreateError(result.error)
        return
      }
      form.reset()
      router.invalidate()
    } catch {
      setCreateError("Could not add provider.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Service Providers</h1>
        <p className="text-sm text-muted-foreground">
          Contractors, mechanics, and repair contacts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onCreate}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                name="name"
                placeholder="Contact name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-company">Company</Label>
              <Input
                id="p-company"
                name="company"
                placeholder="Business name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-specialty">Specialty</Label>
              <select
                id="p-specialty"
                name="specialty"
                className={selectClass}
                defaultValue="OTHER"
              >
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-phone">Phone</Label>
              <Input
                id="p-phone"
                name="phone"
                type="tel"
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-email">Email</Label>
              <Input
                id="p-email"
                name="email"
                type="email"
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-rating">Rating (1-5)</Label>
              <Input
                id="p-rating"
                name="rating"
                type="number"
                min="1"
                max="5"
                placeholder="1-5"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-notes">Notes</Label>
              <Input id="p-notes" name="notes" placeholder="Optional notes" />
            </div>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" /> Add
            </Button>
          </form>
          {createError && (
            <p className="mt-2 text-sm text-destructive">{createError}</p>
          )}
        </CardContent>
      </Card>

      {providers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <HardHat className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No service providers yet. Add your contractors, mechanics, and
              repair contacts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              All Providers ({providers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-center">Repairs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.company || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {p.specialty.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.email || "—"}
                    </TableCell>
                    <TableCell>
                      {p.rating ? (
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: p.rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="size-3 fill-yellow-400 text-yellow-400"
                            />
                          ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {p.repairCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Delete"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteProviderDialog
          provider={deleteTarget}
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

function DeleteProviderDialog({
  provider,
  onClose,
  onDeleted,
}: {
  provider: ProviderRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteProviderFn({ data: { id: provider.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete provider.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {provider.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Repairs done by this provider are kept but lose the provider link.
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
