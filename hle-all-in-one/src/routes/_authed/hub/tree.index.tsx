import { Link, createFileRoute } from "@tanstack/react-router"
import { Settings2 } from "lucide-react"
import { getFamilyTreeFn } from "@/server/hub/fns.relations"
import { FamilyTreeView } from "@/components/hub/family-tree-view"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_authed/hub/tree/")({
  loader: () => getFamilyTreeFn(),
  component: FamilyTreePage,
})

function FamilyTreePage() {
  const { members, relations, currentUserId, relativeRelationships } =
    Route.useLoaderData()

  // Relations are stored in both directions; show unique pairs.
  const uniqueConnections = Math.floor(relations.length / 2)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Family Tree</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "person" : "people"},{" "}
            {uniqueConnections} connection{uniqueConnections !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" render={<Link to="/hub/tree/manage" />}>
          <Settings2 className="size-4" /> Manage Connections
        </Button>
      </div>

      <div
        className="overflow-hidden rounded-lg border"
        style={{ height: "calc(100vh - 220px)" }}
      >
        <FamilyTreeView
          members={members}
          relations={relations}
          currentUserId={currentUserId}
          relativeRelationships={relativeRelationships}
        />
      </div>
    </div>
  )
}
