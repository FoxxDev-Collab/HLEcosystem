import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronRight, FileText, Search, Tag } from "lucide-react"
import { getWikiSearchFn } from "@/server/wiki/fns.search"
import {
  VisibilityBadge,
  formatDateRelative,
} from "@/components/wiki/wiki-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type WikiSearch = { q?: string; tag?: string }

export const Route = createFileRoute("/_authed/wiki/search")({
  validateSearch: (search: Record<string, unknown>): WikiSearch => {
    const q =
      typeof search.q === "string" && search.q.trim()
        ? search.q.slice(0, 200)
        : undefined
    const tag =
      typeof search.tag === "string" && search.tag.trim()
        ? search.tag.slice(0, 100)
        : undefined
    return { ...(q ? { q } : {}), ...(tag ? { tag } : {}) }
  },
  loaderDeps: ({ search }) => ({
    q: search.q ?? null,
    tag: search.tag ?? null,
  }),
  loader: ({ deps }) =>
    getWikiSearchFn({
      data: { q: deps.q ?? undefined, tag: deps.tag ?? undefined },
    }),
  component: WikiSearchPage,
})

function WikiSearchPage() {
  const { results, popularTags } = Route.useLoaderData()
  const { q, tag } = Route.useSearch()
  const navigate = Route.useNavigate()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const value = String(f.get("q") ?? "").trim()
    navigate({ search: value ? { q: value } : {} })
  }

  return (
    <div className="max-w-[800px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          Full-text search across every page you can access
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2" key={q ?? ""}>
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            maxLength={200}
            placeholder="Search pages..."
            className="h-10 pl-9"
            autoFocus
          />
        </div>
        <Button type="submit" className="h-10">
          Search
        </Button>
      </form>

      {popularTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="size-3.5 text-muted-foreground" />
          {popularTags.map((t) => (
            <Link key={t.tag} to="/wiki/search" search={{ tag: t.tag }}>
              <Badge
                variant={tag === t.tag ? "default" : "secondary"}
                className="cursor-pointer text-[11px]"
              >
                {t.tag} ({t.count})
              </Badge>
            </Link>
          ))}
          {tag && (
            <Link to="/wiki/search" search={{}}>
              <Badge variant="outline" className="cursor-pointer text-[11px]">
                Clear
              </Badge>
            </Link>
          )}
        </div>
      )}

      {q && (
        <p className="text-sm text-muted-foreground">
          {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;
          {q}&rdquo;
        </p>
      )}
      {tag && (
        <p className="text-sm text-muted-foreground">
          {results.length} page{results.length === 1 ? "" : "s"} tagged &ldquo;
          {tag}&rdquo;
        </p>
      )}

      <div className="space-y-2">
        {results.map((page) => (
          <Link key={page.id} to="/wiki/pages/$id" params={{ id: page.id }}>
            <div className="group flex cursor-pointer items-center gap-4 rounded-lg border border-border/40 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{page.title}</p>
                {page.snippet && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    <Snippet text={page.snippet} />
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <VisibilityBadge visibility={page.visibility} />
              </div>
              <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                <div>{page.updatedByName ?? "Unknown"}</div>
                <div>{formatDateRelative(page.updatedAt)}</div>
              </div>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>

      {(q || tag) && results.length === 0 && (
        <div className="py-12 text-center">
          <Search className="mx-auto mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No pages match your search.
          </p>
        </div>
      )}
    </div>
  )
}

// ts_headline marks matches with [[...]] delimiters (see
// src/server/wiki/search.ts) — split and render through React, never as HTML.
function Snippet({ text }: { text: string }) {
  const parts = text.split(/\[\[(.*?)\]\]/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={`${i}-${part}`}
            className="rounded-sm bg-primary/15 px-0.5 text-foreground"
          >
            {part}
          </mark>
        ) : (
          <span key={`${i}-${part}`}>{part}</span>
        )
      )}
    </>
  )
}
