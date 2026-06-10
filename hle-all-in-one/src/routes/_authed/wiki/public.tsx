import { createFileRoute } from "@tanstack/react-router"
import { BookOpen, Globe } from "lucide-react"
import { getPublicPagesFn } from "@/server/wiki/fns.pages"
import { PageRow } from "@/components/wiki/wiki-shared"

export const Route = createFileRoute("/_authed/wiki/public")({
  loader: () => getPublicPagesFn(),
  component: PublicPagesPage,
})

function PublicPagesPage() {
  const pages = Route.useLoaderData()

  return (
    <div className="max-w-[800px] space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Public Pages</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {pages.length} page{pages.length === 1 ? "" : "s"} visible to everyone
        </p>
      </div>

      {pages.length === 0 ? (
        <div className="space-y-2 py-12 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No public pages yet. Create a page and set visibility to Public.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <PageRow key={page.id} page={page} showVisibility={false} />
          ))}
        </div>
      )}
    </div>
  )
}
