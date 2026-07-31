import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { ArrowLeft, Play } from "lucide-react"
import { formatDuration } from "@/components/media/format"
import { Poster } from "@/components/media/poster"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { getSeriesFn } from "@/server/media/fns.library"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const Route = createFileRoute("/_authed/media/series/$id")({
  loader: async ({ params }) => {
    if (!UUID_RE.test(params.id)) throw notFound()
    const series = await getSeriesFn({ data: { id: params.id } })
    if (!series) throw notFound()
    return series
  },
  component: SeriesDetailPage,
})

function SeriesDetailPage() {
  const series = Route.useLoaderData()

  const meta = [series.year, series.contentRating].filter(Boolean).join(" · ")

  return (
    <article className="space-y-8">
      <header className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full max-w-xs sm:w-1/3">
          <Poster
            src={series.posterPath}
            title={series.title}
            className="rounded-lg"
          />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-3xl font-bold">{series.title}</h1>
            {meta && (
              <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
            )}
          </div>
          {series.synopsis && (
            <p className="text-sm leading-relaxed">{series.synopsis}</p>
          )}
          <Button variant="ghost" render={<Link to="/media" />}>
            <ArrowLeft className="size-4" /> Back to library
          </Button>
        </div>
      </header>

      {series.seasons.length === 0 ? (
        <p className="text-sm text-muted-foreground">No seasons indexed yet.</p>
      ) : (
        series.seasons.map((season) => (
          <section key={season.id} className="space-y-3">
            <h2 className="text-xl font-semibold">
              Season {season.number}
              {season.title && ` — ${season.title}`}
            </h2>
            <ul className="divide-y rounded-lg border">
              {season.episodes.map((ep) => (
                <li
                  key={ep.id}
                  className="flex items-center justify-between gap-4 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      <span className="mr-2 font-mono text-muted-foreground">
                        S{String(season.number).padStart(2, "0")}E
                        {String(ep.number).padStart(2, "0")}
                      </span>
                      {ep.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(ep.durationSec) || "—"}
                      {ep.airDate && ` · ${formatDate(ep.airDate)}`}
                    </p>
                  </div>
                  {ep.mediaFileId ? (
                    <Button
                      size="sm"
                      render={
                        <Link
                          to="/media/play/$fileId"
                          params={{ fileId: ep.mediaFileId }}
                        />
                      }
                    >
                      <Play className="size-4" /> Play
                    </Button>
                  ) : (
                    <span className="text-xs text-destructive">no file</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </article>
  )
}
