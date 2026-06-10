import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  addMediaCommentFn,
  createMediaRequestFn,
  deleteMediaRequestFn,
  getMediaRequestsPageFn,
  updateMediaRequestStatusFn,
} from "@/server/hub/fns.media-requests"
import type {
  MediaRequestCommentRow,
  MediaRequestRow,
  MediaRequestStatus,
  MediaType,
} from "@/server/hub/media-requests"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export const Route = createFileRoute("/_authed/hub/media-requests")({
  loader: () => getMediaRequestsPageFn(),
  component: MediaRequestsPage,
})

type RequestWithComments = MediaRequestRow & {
  comments: Array<MediaRequestCommentRow>
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  MOVIE: "Movie",
  TV_SHOW: "TV Show",
  MUSIC: "Music",
}

const STATUS_COLORS: Record<MediaRequestStatus, string> = {
  REQUESTED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
}

const TYPE_COLORS: Record<MediaType, string> = {
  MOVIE:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  TV_SHOW:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  MUSIC: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
}

function MediaRequestsPage() {
  const { requests, currentUserId, isAdmin } = Route.useLoaderData()
  const router = useRouter()
  const [createError, setCreateError] = useState<string | null>(null)
  const [createPending, setCreatePending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RequestWithComments | null>(
    null
  )

  const requested = requests.filter((r) => r.status === "REQUESTED")
  const completed = requests.filter((r) => r.status === "COMPLETED")

  function refresh() {
    router.invalidate()
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    setCreateError(null)
    setCreatePending(true)
    const yearStr = String(f.get("year") ?? "")
    try {
      await createMediaRequestFn({
        data: {
          mediaType: String(f.get("mediaType") ?? "MOVIE") as MediaType,
          title: String(f.get("title") ?? ""),
          artist: String(f.get("artist") ?? "") || null,
          year: yearStr ? Number(yearStr) : null,
          notes: String(f.get("notes") ?? "") || null,
        },
      })
      form.reset()
      setCreatePending(false)
      refresh()
    } catch {
      setCreateError("Could not submit request.")
      setCreatePending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Media Requests</h1>
          <p className="text-sm text-muted-foreground">
            Request movies, shows, and music — visible to everyone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{requested.length} requested</Badge>
          <Badge variant="outline">{completed.length} completed</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request Media</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="mr-type">Type *</Label>
                <select
                  id="mr-type"
                  name="mediaType"
                  required
                  className={selectClass}
                  defaultValue="MOVIE"
                >
                  <option value="MOVIE">Movie</option>
                  <option value="TV_SHOW">TV Show</option>
                  <option value="MUSIC">Music</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mr-title">Title *</Label>
                <Input
                  id="mr-title"
                  name="title"
                  required
                  placeholder="e.g. The Dark Knight"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mr-artist">Artist / Director</Label>
                <Input id="mr-artist" name="artist" placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mr-year">Year</Label>
                <Input
                  id="mr-year"
                  name="year"
                  type="number"
                  min="1900"
                  max="2099"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mr-notes">Notes</Label>
              <Textarea
                id="mr-notes"
                name="notes"
                rows={2}
                placeholder="Any details — specific edition, season, album, etc."
              />
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <Button type="submit" disabled={createPending}>
              {createPending ? "Submitting…" : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="requested">
        <TabsList>
          <TabsTrigger value="requested">
            Requested ({requested.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completed.length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requested" className="mt-4 space-y-3">
          <RequestList
            requests={requested}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onChanged={refresh}
            onDelete={setDeleteTarget}
          />
        </TabsContent>
        <TabsContent value="completed" className="mt-4 space-y-3">
          <RequestList
            requests={completed}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onChanged={refresh}
            onDelete={setDeleteTarget}
          />
        </TabsContent>
        <TabsContent value="all" className="mt-4 space-y-3">
          <RequestList
            requests={requests}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onChanged={refresh}
            onDelete={setDeleteTarget}
          />
        </TabsContent>
      </Tabs>

      {deleteTarget && (
        <DeleteRequestDialog
          request={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function RequestList({
  requests,
  currentUserId,
  isAdmin,
  onChanged,
  onDelete,
}: {
  requests: Array<RequestWithComments>
  currentUserId: string
  isAdmin: boolean
  onChanged: () => void
  onDelete: (request: RequestWithComments) => void
}) {
  if (requests.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No requests in this category.
      </p>
    )
  }

  async function setStatus(id: string, status: MediaRequestStatus) {
    await updateMediaRequestStatusFn({ data: { id, status } })
    onChanged()
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const isOwner = request.requesterId === currentUserId
        return (
          <Card key={request.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-medium">{request.title}</p>
                    <Badge className={TYPE_COLORS[request.mediaType]}>
                      {MEDIA_TYPE_LABELS[request.mediaType]}
                    </Badge>
                    <Badge className={STATUS_COLORS[request.status]}>
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Requested by {request.requesterName}
                    {request.artist && ` · ${request.artist}`}
                    {request.year && ` (${request.year})`}
                    {` · ${formatDate(request.createdAt)}`}
                  </p>
                  {request.notes && (
                    <p className="text-sm text-muted-foreground">
                      {request.notes}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {request.status === "REQUESTED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus(request.id, "COMPLETED")}
                    >
                      Mark Completed
                    </Button>
                  )}
                  {request.status === "COMPLETED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus(request.id, "REQUESTED")}
                    >
                      Reopen
                    </Button>
                  )}
                  {(isOwner || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => onDelete(request)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {request.comments.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  {request.comments.map((comment) => (
                    <div key={comment.id} className="text-sm">
                      <span className="font-medium">{comment.userName}</span>{" "}
                      <span className="text-muted-foreground">
                        {formatDate(comment.createdAt)}
                      </span>
                      <p className="text-muted-foreground">{comment.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {request.status === "REQUESTED" && (
                <CommentForm requestId={request.id} onAdded={onChanged} />
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function CommentForm({
  requestId,
  onAdded,
}: {
  requestId: string
  onAdded: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    setError(null)
    setPending(true)
    try {
      const result = await addMediaCommentFn({
        data: { requestId, message: String(f.get("message") ?? "") },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setPending(false)
      onAdded()
    } catch {
      setError("Could not add comment.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1 pt-1">
      <div className="flex gap-2">
        <Input
          name="message"
          placeholder="Add a comment..."
          className="flex-1"
          required
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Posting…" : "Comment"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

function DeleteRequestDialog({
  request,
  onClose,
  onDeleted,
}: {
  request: RequestWithComments
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteMediaRequestFn({ data: { id: request.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete request.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{request.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The request and its comments will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
