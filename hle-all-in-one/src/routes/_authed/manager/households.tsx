import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Check, Home, Plus, Trash2, UserPlus } from "lucide-react"
import { switchHouseholdFn } from "@/server/fns.auth"
import {
  addMemberFn,
  createHouseholdFn,
  getHouseholdsPageFn,
  removeMemberFn,
} from "@/server/fns.households"
import type { HouseholdRole, MemberWithUser } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export const Route = createFileRoute("/_authed/manager/households")({
  loader: () => getHouseholdsPageFn(),
  component: HouseholdsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function HouseholdsPage() {
  const { households, active, members } = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<MemberWithUser | null>(null)

  function refresh() {
    router.invalidate()
  }

  async function switchTo(id: string) {
    if (id === active?.id) return
    await switchHouseholdFn({ data: { householdId: id } })
    refresh()
  }

  const isOwner = active?.role === "OWNER"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Households</h1>
          <p className="text-sm text-muted-foreground">
            Groups you belong to. Switch the active one, or create a new one.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New household
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {households.map((h) => (
          <Card
            key={h.id}
            className={h.id === active?.id ? "border-primary" : ""}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Home className="size-4 text-muted-foreground" />
                {h.name}
              </CardTitle>
              <CardDescription>
                <Badge variant="secondary">{h.role}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {h.id === active?.id ? (
                <span className="flex items-center gap-1 text-sm text-primary">
                  <Check className="size-4" /> Active
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => switchTo(h.id)}
                >
                  Switch to this
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {households.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You don&apos;t belong to any household yet. Create one to get
            started.
          </p>
        )}
      </div>

      {active && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {active.name} · Members
                </CardTitle>
                <CardDescription>
                  {isOwner
                    ? "Add existing users by email. Only an admin can create new accounts."
                    : "Only the household owner can manage members."}
                </CardDescription>
              </div>
              {isOwner && (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <UserPlus className="size-4" /> Add member
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {isOwner && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.membershipId}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={m.role === "OWNER" ? "default" : "secondary"}
                      >
                        {m.role}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        {m.role !== "OWNER" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remove"
                            onClick={() => setRemoveTarget(m)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {createOpen && (
        <CreateHouseholdDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            refresh()
          }}
        />
      )}
      {addOpen && (
        <AddMemberDialog
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            refresh()
          }}
        />
      )}
      {removeTarget && (
        <RemoveMemberDialog
          member={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onRemoved={() => {
            setRemoveTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function CreateHouseholdDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createHouseholdFn({
        data: { name: String(f.get("name") ?? "") },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not create household.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New household</DialogTitle>
          <DialogDescription>
            You become the owner. It becomes your active household.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="h-name">Name</Label>
            <Input id="h-name" name="name" required autoFocus />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddMemberDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await addMemberFn({
        data: {
          email: String(f.get("email") ?? ""),
          role: String(f.get("role") ?? "MEMBER") as HouseholdRole,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not add member.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Enter the email of an existing user to add them to this household.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-email">Email</Label>
            <Input id="m-email" name="email" type="email" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-role">Role</Label>
            <select
              id="m-role"
              name="role"
              className={selectClass}
              defaultValue="MEMBER"
            >
              <option value="MEMBER">Member</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RemoveMemberDialog({
  member,
  onClose,
  onRemoved,
}: {
  member: MemberWithUser
  onClose: () => void
  onRemoved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await removeMemberFn({
        data: { membershipId: member.membershipId },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onRemoved()
    } catch {
      setError("Could not remove member.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to this household. Their account is not deleted.
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
            {pending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
