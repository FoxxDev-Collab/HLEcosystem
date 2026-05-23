import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Poster } from "@/components/poster";
import { api } from "@/lib/api";
import { navigate } from "@/lib/router";
import type { LibraryItem } from "@/lib/types";

export function LibraryGrid() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ items: LibraryItem[] }>("/api/library")
      .then((d) => {
        if (!cancelled) setItems(d.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "load failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-destructive text-sm">Error: {error}</p>;
  }
  if (!items) {
    return <p className="text-muted-foreground text-sm">Loading library…</p>;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">No media yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Click <span className="font-mono">Scan</span> in the header to index
          your library.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <button
          key={`${item.kind}-${item.id}`}
          className="text-left transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring rounded-lg"
          onClick={() =>
            navigate(`/${item.kind === "movie" ? "movies" : "series"}/${item.id}`)
          }
        >
          <Card className="overflow-hidden gap-0 py-0">
            <Poster src={item.posterPath} title={item.title} />
            <CardContent className="p-3">
              <p className="font-medium truncate" title={item.title}>
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.year ?? "—"}
                {item.kind === "series" && ` · ${item.episodeCount} ep`}
              </p>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}
