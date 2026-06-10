import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react"
import {
  createRelationFn,
  deleteRelationFn,
  getManageRelationsFn,
} from "@/server/hub/fns.relations"
import type { RelationWithMembersRow } from "@/server/hub/relations"
import {
  FAMILY_RELATIONSHIPS,
  formatRelationship,
} from "@/lib/hub/relationships"
import type { Relationship } from "@/lib/hub/relationships"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/hub/tree/manage")({
  loader: () => getManageRelationsFn(),
  component: ManageRelationsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function ManageRelationsPage() {
  const { members, relations } = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [deleteTarget, setDeleteTarget] =
    useState<RelationWithMembersRow | null>(null)

  // Relations are stored in both directions; only show one per pair.
  const seen = new Set<string>()
  const uniqueRelations = relations.filter((r) => {
    const key = [r.fromMemberId, r.toMemberId].sort().join("|")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createRelationFn({
        data: {
          fromMemberId: String(f.get("fromMemberId") ?? ""),
          toMemberId: String(f.get("toMemberId") ?? ""),
          relationType: String(f.get("relationType") ?? "") as Relationship,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setPending(false)
      router.invalidate()
    } catch {
      setError("Could not add connection.")
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link to="/hub/tree" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Manage Connections</h1>
          <p className="text-sm text-muted-foreground">
            Define how people in your household are related
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Connection</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              You need at least 2 people to create a connection.{" "}
              <Link to="/hub/people" className="text-primary hover:underline">
                Add people first
              </Link>
              .
            </p>
          ) : (
            <form
              onSubmit={onSubmit}
              className="flex flex-wrap items-end gap-4"
            >
              <div className="min-w-[180px] space-y-2">
                <Label htmlFor="r-from">Person A</Label>
                <select
                  id="r-from"
                  name="fromMemberId"
                  required
                  className={selectClass}
                  defaultValue=""
                >
                  <option value="">Select...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[160px] space-y-2">
                <Label htmlFor="r-type">is the ... of</Label>
                <select
                  id="r-type"
                  name="relationType"
                  required
                  className={selectClass}
                >
                  {FAMILY_RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>
                      {formatRelationship(r)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[180px] space-y-2">
                <Label htmlFor="r-to">Person B</Label>
                <select
                  id="r-to"
                  name="toMemberId"
                  required
                  className={selectClass}
                  defaultValue=""
                >
                  <option value="">Select...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" disabled={pending}>
                <Plus className="size-4" /> {pending ? "Adding…" : "Add"}
              </Button>
            </form>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            The inverse relationship is created automatically (e.g. adding
            &quot;Parent&quot; also creates &quot;Child&quot; in the other
            direction).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Existing Connections{" "}
            <Badge variant="secondary" className="ml-2">
              {uniqueRelations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {uniqueRelations.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No connections yet. Add one above to start building your family
              tree.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person A</TableHead>
                  <TableHead className="text-center">Relationship</TableHead>
                  <TableHead>Person B</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueRelations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.fromFirstName} {r.fromLastName}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline">
                          {formatRelationship(r.relationType)}
                        </Badge>
                        <ArrowRight className="size-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.toFirstName} {r.toLastName}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete connection"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {deleteTarget && (
        <DeleteRelationDialog
          relation={deleteTarget}
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

function DeleteRelationDialog({
  relation,
  onClose,
  onDeleted,
}: {
  relation: RelationWithMembersRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteRelationFn({ data: { id: relation.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete connection.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this connection?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes the connection between {relation.fromFirstName}{" "}
            {relation.fromLastName} and {relation.toFirstName}{" "}
            {relation.toLastName}, including the inverse direction.
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
