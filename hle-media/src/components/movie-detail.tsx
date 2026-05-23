import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Poster } from "@/components/poster";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { navigate } from "@/lib/router";
import type { MovieDetail as MovieDetailType } from "@/lib/types";

export function MovieDetail({ id }: { id: string }) {
  const [movie, setMovie] = useState<MovieDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMovie(null);
    setError(null);
    api<MovieDetailType>(`/api/movies/${encodeURIComponent(id)}`)
      .then((m) => {
        if (!cancelled) setMovie(m);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "load failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="text-destructive text-sm">Error: {error}</p>;
  if (!movie) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const meta = [
    movie.year,
    movie.contentRating,
    formatDuration(movie.durationSec) || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex flex-col gap-6 sm:flex-row">
      <div className="w-full max-w-xs sm:w-1/3">
        <Poster src={movie.posterPath} title={movie.title} className="rounded-lg" />
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">{movie.title}</h1>
          {meta && <p className="text-sm text-muted-foreground mt-1">{meta}</p>}
        </div>

        {movie.synopsis && (
          <p className="text-sm leading-relaxed">{movie.synopsis}</p>
        )}

        <div className="flex items-center gap-3">
          {movie.mediaFileId ? (
            <Button onClick={() => navigate(`/play/${movie.mediaFileId}`)}>
              ▶ Play
            </Button>
          ) : (
            <p className="text-sm text-destructive">No media file linked.</p>
          )}
          <Button variant="ghost" onClick={() => navigate("/")}>
            ← Back to library
          </Button>
        </div>
      </div>
    </article>
  );
}
