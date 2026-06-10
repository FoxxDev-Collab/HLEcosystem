import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  History,
  Save,
  Tag,
  User,
} from "lucide-react"
import type { JSONContent } from "@tiptap/react"
import { getPageForEditFn, updatePageFn } from "@/server/wiki/fns.pages"
import { WikiEditor } from "@/components/wiki/wiki-editor"
import {
  VisibilityBadge,
  estimateReadingTime,
  formatDateRelative,
} from "@/components/wiki/wiki-shared"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export const Route = createFileRoute("/_authed/wiki/pages/$id/edit")({
  loader: async ({ params }) => {
    const data = await getPageForEditFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: EditPagePage,
})

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

const SHORTCUTS: Array<{ label: string; keys: string }> = [
  { label: "Save", keys: "Ctrl+S" },
  { label: "Bold", keys: "Ctrl+B" },
  { label: "Italic", keys: "Ctrl+I" },
  { label: "Underline", keys: "Ctrl+U" },
  { label: "Undo", keys: "Ctrl+Z" },
  { label: "Hard break", keys: "Shift+Enter" },
]

function EditPagePage() {
  const { page, createdByName, updatedByName, versionCount, tags } =
    Route.useLoaderData()
  // page.content arrives as JSONB text (serialization-safe); parse once for
  // the editor's initial document.
  const initialContent = useMemo(
    () => JSON.parse(page.content) as JSONContent,
    [page.content]
  )

  const [title, setTitle] = useState(page.title)
  const contentRef = useRef<JSONContent>(initialContent)
  const contentTextRef = useRef(page.contentText)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(page.wordCount)
  const [charCount, setCharCount] = useState(0)

  const handleSave = useCallback(async () => {
    if (saving) return
    const trimmed = title.trim()
    if (!trimmed) {
      setError("Title cannot be empty.")
      return
    }
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const result = await updatePageFn({
        data: {
          id: page.id,
          title: trimmed,
          content: JSON.stringify(contentRef.current),
          contentText: contentTextRef.current,
        },
      })
      if ("error" in result) {
        setError(result.error ?? "Could not save the page.")
        return
      }
      setSaved(true)
      setDirty(false)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError("Could not save the page.")
    } finally {
      setSaving(false)
    }
  }, [page.id, title, saving])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [handleSave])

  const handleContentChange = useCallback((json: JSONContent, text: string) => {
    contentRef.current = json
    contentTextRef.current = text
    setDirty(true)
    setWordCount(countWords(text))
    setCharCount(text.length)
  }, [])

  return (
    <div className="flex max-w-[1200px] gap-6">
      {/* ─── Main editor column ─── */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
              render={<Link to="/wiki/pages/$id" params={{ id: page.id }} />}
            >
              <ArrowLeft className="size-3.5" /> Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <VisibilityBadge visibility={page.visibility} />
          </div>
          <div className="flex items-center gap-2">
            {dirty && !saving && !saved && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-3" /> Unsaved changes
              </span>
            )}
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" /> Saved
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              variant={dirty ? "default" : "secondary"}
              size="sm"
              className="h-8 gap-1.5"
            >
              <Save className="size-3.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setDirty(true)
          }}
          maxLength={300}
          className="w-full border-none bg-transparent py-2 text-3xl font-bold shadow-none placeholder:text-muted-foreground/40 focus-visible:outline-none md:text-4xl"
          placeholder="Page title..."
        />

        <WikiEditor content={initialContent} onChange={handleContentChange} />
      </div>

      {/* ─── Side panel ─── */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-6 space-y-5">
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Document
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Created by
                  </div>
                  <div className="text-[13px] font-medium">
                    {createdByName ?? "Unknown"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDate(page.createdAt)}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Last edited by
                  </div>
                  <div className="text-[13px] font-medium">
                    {updatedByName ?? "Unknown"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDateRelative(page.updatedAt)}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="opacity-40" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <BookOpen className="size-3" /> Words
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {wordCount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" /> Read
                </div>
                <div className="text-sm font-semibold">
                  {estimateReadingTime(wordCount)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <History className="size-3" /> Versions
                </div>
                <div className="text-sm font-semibold">{versionCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground"># Chars</div>
                <div className="text-sm font-semibold tabular-nums">
                  {charCount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {tags.length > 0 && (
            <>
              <Separator className="opacity-40" />
              <div className="space-y-2">
                <h3 className="flex items-center gap-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  <Tag className="size-3" /> Tags
                </h3>
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator className="opacity-40" />
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Shortcuts
            </h3>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex justify-between">
                  <span>{s.label}</span>
                  <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
