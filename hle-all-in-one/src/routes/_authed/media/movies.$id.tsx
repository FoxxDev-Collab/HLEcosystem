import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { ArrowLeft, Play } from "lucide-react"
import { formatBytes, formatDuration } from "@/components/media/format"
import { Poster } from "@/components/media/poster"
import { Button } from "@/components/ui/button"
import { getMovieFn } from "@/server/media/fns.library"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const Route = createFileRoute("/_authed/media/movies/$id")({
  loader: async ({ params }) => {
    if (!UUID_RE.test(params.id)) throw notFound()
    const movie = await getMovieFn({ data: { id: params.id } })
    if (!movie) throw notFound()
    return movie
  },
  component: MovieDetailPage,
})

function MovieDetailPage() {
  const movie = Route.useLoaderData()

  const meta = [
    movie.year,
    movie.contentRating,
    formatDuration(movie.durationSec) || null,
  ]
    .filter(Boolean)
    .join(" · ")

  const fileInfo = [
    movie.fileWidth && movie.fileHeight
      ? `${movie.fileWidth}×${movie.fileHeight}`
      : null,
    [movie.fileVideoCodec, movie.fileAudioCodec].filter(Boolean).join("/") ||
      null,
    movie.fileContainer,
    formatBytes(movie.fileSizeBytes) || null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <article className="flex flex-col gap-6 sm:flex-row">
      <div className="w-full max-w-xs sm:w-1/3">
        <Poster
          src={movie.posterPath}
          title={movie.title}
          className="rounded-lg"
        />
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">{movie.title}</h1>
          {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
        </div>

        {movie.synopsis && (
          <p className="text-sm leading-relaxed">{movie.synopsis}</p>
        )}

        {fileInfo && (
          <p className="font-mono text-xs text-muted-foreground">{fileInfo}</p>
        )}

        <div className="flex items-center gap-3">
          {movie.mediaFileId ? (
            <Button
              render={
                <Link
                  to="/media/play/$fileId"
                  params={{ fileId: movie.mediaFileId }}
                />
              }
            >
              <Play className="size-4" /> Play
            </Button>
          ) : (
            <p className="text-sm text-destructive">No media file linked.</p>
          )}
          <Button variant="ghost" render={<Link to="/media" />}>
            <ArrowLeft className="size-4" /> Back to library
          </Button>
        </div>
      </div>
    </article>
  )
}
