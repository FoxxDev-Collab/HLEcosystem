import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { BookOpen, Lock, Plus } from "lucide-react"
import { createPageFn, getPersonalPagesFn } from "@/server/wiki/fns.pages"
import { PageRow } from "@/components/wiki/wiki-shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/_authed/wiki/personal")({
  loader: () => getPersonalPagesFn(),
  component: PersonalPagesPage,
})

function PersonalPagesPage() {
  const pages = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const title = String(f.get("title") ?? "").trim()
    if (!title) return
    setError(null)
    setPending(true)
    try {
      const result = await createPageFn({
        data: { title, visibility: "PRIVATE", parentId: null, template: null },
      })
      if ("error" in result) {
        setError(result.error ?? "Could not create page.")
        return
      }
      if ("id" in result && result.id) {
        router.navigate({
          to: "/wiki/pages/$id/edit",
          params: { id: result.id },
        })
      }
    } catch {
      setError("Could not create page.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="max-w-[800px] space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Personal Notes</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {pages.length} private page{pages.length === 1 ? "" : "s"} — only
          visible to you
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-5">
        <form onSubmit={onSubmit} className="flex items-end gap-4">
          <div className="flex-1 space-y-1.5">
            <Label
              htmlFor="personal-title"
              className="text-xs font-medium text-muted-foreground"
            >
              New Personal Page
            </Label>
            <Input
              id="personal-title"
              name="title"
              required
              maxLength={300}
              placeholder="What's on your mind?"
              className="h-10"
            />
          </div>
          <Button type="submit" disabled={pending} className="h-10">
            <Plus className="mr-1.5 size-4" /> Create
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>

      {pages.length === 0 ? (
        <div className="space-y-2 py-12 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No personal notes yet. These are private to you.
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
