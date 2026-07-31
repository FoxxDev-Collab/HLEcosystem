import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ShieldCheck } from "lucide-react"
import { LibraryGrid } from "@/components/media/library-grid"
import { ScanPanel } from "@/components/media/scan-panel"
import { getLibraryPageFn } from "@/server/media/fns.library"

export const Route = createFileRoute("/_authed/media/")({
  loader: () => getLibraryPageFn(),
  component: MediaLibraryPage,
})

function MediaLibraryPage() {
  const { counts, items, canManage, scanRuns, restricted } =
    Route.useLoaderData()
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            {counts.movies} movies · {counts.series} series · {counts.episodes}{" "}
            episodes
          </p>
        </div>
        {restricted && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" /> Parental controls active
          </span>
        )}
      </div>

      {canManage && (
        <ScanPanel
          initialRuns={scanRuns}
          onLibraryChanged={() => router.invalidate()}
        />
      )}

      <LibraryGrid items={items} />
    </div>
  )
}
