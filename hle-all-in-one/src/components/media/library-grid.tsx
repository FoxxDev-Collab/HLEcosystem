import { Link } from "@tanstack/react-router"
import { Card, CardContent } from "@/components/ui/card"
import { Poster } from "./poster"
import type { LibraryItem } from "@/server/media/library"

export function LibraryGrid({ items }: { items: Array<LibraryItem> }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">No media yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Run a <span className="font-mono">Scan</span> to index your library.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <Link
          key={`${item.kind}-${item.id}`}
          to={item.kind === "movie" ? "/media/movies/$id" : "/media/series/$id"}
          params={{ id: item.id }}
          className="rounded-lg text-left transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Card className="gap-0 overflow-hidden py-0">
            <Poster src={item.posterPath} title={item.title} />
            <CardContent className="p-3">
              <p className="truncate font-medium" title={item.title}>
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.year ?? "—"}
                {item.kind === "series" && ` · ${item.episodeCount} ep`}
                {item.contentRating && ` · ${item.contentRating}`}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
