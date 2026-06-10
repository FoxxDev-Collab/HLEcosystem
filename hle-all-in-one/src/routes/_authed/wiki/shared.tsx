import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronRight, Eye, FileText, Pencil, Share2 } from "lucide-react"
import { getSharedPagesFn } from "@/server/wiki/fns.pages"
import { formatDateRelative } from "@/components/wiki/wiki-shared"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/_authed/wiki/shared")({
  loader: () => getSharedPagesFn(),
  component: SharedPagesPage,
})

function SharedPagesPage() {
  const pages = Route.useLoaderData()

  return (
    <div className="max-w-[800px] space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Shared with Me</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {pages.length} page{pages.length === 1 ? "" : "s"} shared to your
          household
        </p>
      </div>

      {pages.length === 0 ? (
        <div className="space-y-2 py-12 text-center">
          <Share2 className="mx-auto size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No pages have been shared with your household yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <Link key={page.id} to="/wiki/pages/$id" params={{ id: page.id }}>
              <div className="group flex cursor-pointer items-center gap-4 rounded-lg border border-border/40 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{page.title}</p>
                  {page.contentText && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {page.contentText.substring(0, 100)}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                  {page.permission === "EDIT" ? (
                    <Pencil className="size-2.5" />
                  ) : (
                    <Eye className="size-2.5" />
                  )}
                  {page.permission === "EDIT" ? "Can Edit" : "View Only"}
                </Badge>
                <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                  <div>{page.updatedByName ?? "Unknown"}</div>
                  <div>{formatDateRelative(page.updatedAt)}</div>
                </div>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
