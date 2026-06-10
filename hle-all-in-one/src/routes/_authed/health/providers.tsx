import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ExternalLink, Pause, Play, Plus, Trash2 } from "lucide-react"
import {
  createProviderFn,
  deleteProviderFn,
  getHealthProvidersFn,
  toggleProviderActiveFn,
} from "@/server/health/fns.providers"
import type { ProviderRow, ProviderType } from "@/server/health/providers"
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

export const Route = createFileRoute("/_authed/health/providers")({
  loader: () => getHealthProvidersFn(),
  component: ProvidersPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const PROVIDER_TYPES: Array<ProviderType> = [
  "DOCTOR",
  "DENTIST",
  "OPTOMETRIST",
  "SPECIALIST",
  "HOSPITAL",
  "LAB",
  "PHARMACY",
  "THERAPIST",
  "CHIROPRACTOR",
  "VETERINARIAN",
  "OTHER",
]

function ProvidersPage() {
  const providers = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProviderRow | null>(null)

  // Legacy layout: active providers grouped by type, inactive at the bottom.
  const grouped = new Map<string, Array<ProviderRow>>()
  for (const p of providers.filter((row) => row.isActive)) {
    const existing = grouped.get(p.type) ?? []
    existing.push(p)
    grouped.set(p.type, existing)
  }
  const inactive = providers.filter((p) => !p.isActive)

  function refresh() {
    router.invalidate()
  }

  async function onToggle(id: string) {
    setError(null)
    try {
      const result = await toggleProviderActiveFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      refresh()
    } catch {
      setError("Could not update the provider.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Providers</h1>
        <p className="text-sm text-muted-foreground">
          Directory of doctors, dentists, labs, pharmacies and other medical
          providers.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <AddProviderCard onSaved={refresh} />

      {Array.from(grouped.entries()).map(([type, provs]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="text-base">
              {type.replace(/_/g, " ")} ({provs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {provs.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.specialty && (
                        <Badge variant="outline" className="text-xs">
                          {p.specialty}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p.phoneNumber}
                      {p.address && ` · ${p.address}`}
                      {p.email && ` · ${p.email}`}
                    </div>
                    {p.notes && (
                      <div className="mt-0.5 text-xs text-muted-foreground italic">
                        {p.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {p.portalUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Open patient portal"
                        render={
                          <a
                            href={p.portalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Deactivate"
                      onClick={() => onToggle(p.id)}
                    >
                      <Pause className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {inactive.length > 0 && (
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Inactive ({inactive.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {inactive.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-sm">{p.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Reactivate"
                    onClick={() => onToggle(p.id)}
                  >
                    <Play className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {providers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No providers yet. Add one above to build your directory.
            </p>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteProviderDialog
          provider={deleteTarget}
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

function AddProviderCard({ onSaved }: { onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createProviderFn({
        data: {
          name: String(f.get("name") ?? ""),
          type: String(f.get("type") ?? "DOCTOR") as ProviderType,
          specialty: String(f.get("specialty") ?? ""),
          phoneNumber: String(f.get("phoneNumber") ?? ""),
          address: String(f.get("address") ?? ""),
          email: String(f.get("email") ?? ""),
          website: String(f.get("website") ?? ""),
          portalUrl: String(f.get("portalUrl") ?? ""),
          notes: String(f.get("notes") ?? ""),
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
      setError("Could not add the provider.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Provider</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="provider-name">Name</Label>
            <Input
              id="provider-name"
              name="name"
              placeholder="Dr. Smith"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-type">Type</Label>
            <select
              id="provider-type"
              name="type"
              className={selectClass}
              defaultValue="DOCTOR"
            >
              {PROVIDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-specialty">Specialty</Label>
            <Input
              id="provider-specialty"
              name="specialty"
              placeholder="e.g. Pediatrics"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-phone">Phone</Label>
            <Input id="provider-phone" name="phoneNumber" type="tel" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="provider-address">Address</Label>
            <Input id="provider-address" name="address" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-email">Email</Label>
            <Input id="provider-email" name="email" type="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-website">Website</Label>
            <Input
              id="provider-website"
              name="website"
              type="url"
              placeholder="https://"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-portalUrl">Patient Portal</Label>
            <Input
              id="provider-portalUrl"
              name="portalUrl"
              type="url"
              placeholder="https://"
            />
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="provider-notes">Notes</Label>
            <Input id="provider-notes" name="notes" />
          </div>
          <Button type="submit" disabled={pending} className="lg:col-span-4">
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Provider"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
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
      setError("Could not delete the provider.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {provider.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The provider will be removed from your directory. Appointments and
            visits that reference it will keep their other details.
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
