import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  clearParentalProfileFn,
  getParentalPageFn,
  setParentalProfileFn,
} from "@/server/media/fns.parental"

export const Route = createFileRoute("/_authed/media/parental")({
  loader: () => getParentalPageFn(),
  component: ParentalControlsPage,
})

// Mirror of MOVIE_RATINGS / TV_RATINGS in @/server/media/parental.ts —
// duplicated so the client bundle never imports the server data layer.
const MOVIE_RATINGS = ["G", "PG", "PG-13", "R", "NC-17"] as const
const TV_RATINGS = ["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"] as const

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

type MemberRow = Awaited<
  ReturnType<typeof getParentalPageFn>
>["members"][number]

function ParentalControlsPage() {
  const { members } = Route.useLoaderData()
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Parental Controls</h1>
        <p className="text-sm text-muted-foreground">
          Per-member rating ceilings for the media library. Members without a
          profile are unrestricted. Blocking unrated content also hides titles
          the scanner hasn&apos;t matched yet.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {members.map((m) => (
          <MemberCard
            key={m.userId}
            member={m}
            onSaved={() => router.invalidate()}
          />
        ))}
        {members.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No members in this household yet.
          </p>
        )}
      </div>
    </div>
  )
}

function MemberCard({
  member,
  onSaved,
}: {
  member: MemberRow
  onSaved: () => void
}) {
  const [maxMovieRating, setMaxMovieRating] = useState(
    member.profile?.maxMovieRating ?? ""
  )
  const [maxTvRating, setMaxTvRating] = useState(
    member.profile?.maxTvRating ?? ""
  )
  const [blockUnrated, setBlockUnrated] = useState(
    member.profile?.blockUnrated ?? false
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save() {
    setError(null)
    setPending(true)
    try {
      const result = await setParentalProfileFn({
        data: {
          userId: member.userId,
          maxMovieRating:
            maxMovieRating === ""
              ? null
              : (maxMovieRating as (typeof MOVIE_RATINGS)[number]),
          maxTvRating:
            maxTvRating === ""
              ? null
              : (maxTvRating as (typeof TV_RATINGS)[number]),
          blockUnrated,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not save the profile.")
    } finally {
      setPending(false)
    }
  }

  async function clear() {
    setError(null)
    setPending(true)
    try {
      await clearParentalProfileFn({ data: { userId: member.userId } })
      setMaxMovieRating("")
      setMaxTvRating("")
      setBlockUnrated(false)
      onSaved()
    } catch {
      setError("Could not clear the profile.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {member.displayName || member.name}
            </CardTitle>
            <CardDescription>{member.email}</CardDescription>
          </div>
          {member.profile ? (
            <Badge variant="secondary">
              <ShieldCheck className="size-3" /> Restricted
            </Badge>
          ) : (
            <Badge variant="outline">Unrestricted</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`movie-${member.userId}`}>Max movie rating</Label>
            <select
              id={`movie-${member.userId}`}
              className={selectClass}
              value={maxMovieRating}
              onChange={(e) => setMaxMovieRating(e.target.value)}
            >
              <option value="">No limit</option>
              {MOVIE_RATINGS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`tv-${member.userId}`}>Max TV rating</Label>
            <select
              id={`tv-${member.userId}`}
              className={selectClass}
              value={maxTvRating}
              onChange={(e) => setMaxTvRating(e.target.value)}
            >
              <option value="">No limit</option>
              {TV_RATINGS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`unrated-${member.userId}`}
            checked={blockUnrated}
            onCheckedChange={(checked) => setBlockUnrated(checked === true)}
          />
          <Label htmlFor={`unrated-${member.userId}`}>
            Block unrated content
          </Label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {member.profile && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={clear}
            >
              Clear (unrestrict)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
