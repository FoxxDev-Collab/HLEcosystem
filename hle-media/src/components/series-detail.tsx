import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Poster } from "@/components/poster";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { navigate } from "@/lib/router";
import type { SeriesDetail as SeriesDetailType } from "@/lib/types";

export function SeriesDetail({ id }: { id: string }) {
  const [series, setSeries] = useState<SeriesDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    setError(null);
    api<SeriesDetailType>(`/api/series/${encodeURIComponent(id)}`)
      .then((s) => {
        if (!cancelled) setSeries(s);
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
  if (!series) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const meta = [series.year, series.contentRating].filter(Boolean).join(" · ");

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
            {meta && <p className="text-sm text-muted-foreground mt-1">{meta}</p>}
          </div>
          {series.synopsis && (
            <p className="text-sm leading-relaxed">{series.synopsis}</p>
          )}
          <Button variant="ghost" onClick={() => navigate("/")}>
            ← Back to library
          </Button>
        </div>
      </header>

      {series.seasons.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No seasons indexed yet.
        </p>
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
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      <span className="text-muted-foreground mr-2 font-mono">
                        S{String(season.number).padStart(2, "0")}E
                        {String(ep.number).padStart(2, "0")}
                      </span>
                      {ep.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(ep.durationSec) || "—"}
                      {ep.airDate && ` · ${ep.airDate}`}
                    </p>
                  </div>
                  {ep.mediaFileId ? (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/play/${ep.mediaFileId}`)}
                    >
                      ▶ Play
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
  );
}
