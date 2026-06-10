import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Gift, Plus, Star, Trash2, Trophy } from "lucide-react"
import {
  createRewardFn,
  deleteRewardFn,
  getRewardsPageFn,
  redeemRewardFn,
} from "@/server/home-care/fns.chores"
import type { RewardRow } from "@/server/home-care/chores"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

export const Route = createFileRoute("/_authed/home-care/chores/rewards")({
  loader: () => getRewardsPageFn(),
  component: RewardsPage,
})

const selectClass =
  "h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

type MemberBalance = {
  memberId: string
  memberName: string
  earned: number
  spent: number
  balance: number
}

function RewardsPage() {
  const { rewards, redemptions, memberBalances } = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<RewardRow | null>(null)

  const activeRewards = rewards.filter((r) => r.isActive)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Rewards</h1>
        <p className="text-sm text-muted-foreground">
          Spend chore points on rewards. Balance = points earned − points spent.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4" /> Points Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memberBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No household members found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...memberBalances]
                  .sort((a, b) => b.earned - a.earned)
                  .map((m, idx) => (
                    <TableRow key={m.memberId}>
                      <TableCell>
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : idx === 1
                                ? "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400"
                                : idx === 2
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                  : "bg-primary/10 text-primary"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {m.memberName}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {m.earned}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.spent}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {m.balance}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddRewardCard onSaved={() => router.invalidate()} />

      {rewards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Star className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No rewards defined yet. Add some above to motivate your household.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="size-4" /> Reward Catalog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeRewards.map((reward) => (
                <div
                  key={reward.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{reward.title}</h3>
                      {reward.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {reward.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-sm font-bold">
                      {reward.pointCost} pts
                    </Badge>
                  </div>

                  <RedeemForm
                    rewardId={reward.id}
                    rewardCost={reward.pointCost}
                    members={memberBalances}
                    onRedeemed={() => router.invalidate()}
                  />

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={() => setDeleteTarget(reward)}
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {redemptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Redemption History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead className="text-right">Points Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(r.redeemedAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.redeemedByName}
                    </TableCell>
                    <TableCell>{r.rewardTitle}</TableCell>
                    <TableCell className="text-right font-medium">
                      -{r.pointsSpent}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteRewardDialog
          reward={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function AddRewardCard({ onSaved }: { onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createRewardFn({
        data: {
          title: String(f.get("title") ?? ""),
          description: String(f.get("description") ?? ""),
          pointCost: Number(f.get("pointCost") ?? 0),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setPending(false)
      onSaved()
    } catch {
      setError("Could not create reward.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Reward</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="r-title">Reward Name</Label>
            <Input
              id="r-title"
              name="title"
              placeholder="e.g. Movie Night Pick"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-cost">Point Cost</Label>
            <Input
              id="r-cost"
              name="pointCost"
              type="number"
              min="1"
              placeholder="100"
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="r-description">Description</Label>
            <Input
              id="r-description"
              name="description"
              placeholder="Optional details"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Reward"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function RedeemForm({
  rewardId,
  rewardCost,
  members,
  onRedeemed,
}: {
  rewardId: string
  rewardCost: number
  members: Array<MemberBalance>
  onRedeemed: () => void
}) {
  const [selectedId, setSelectedId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const eligible = members.filter((m) => m.balance >= rewardCost)

  async function redeem() {
    setError(null)
    setPending(true)
    try {
      const result = await redeemRewardFn({
        data: { rewardId, redeemedById: selectedId },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      setSelectedId("")
      setPending(false)
      onRedeemed()
    } catch {
      setError("Could not redeem reward.")
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`redeem-${rewardId}`} className="text-xs">
            Redeem for
          </Label>
          <select
            id={`redeem-${rewardId}`}
            className={selectClass}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">
              {eligible.length === 0
                ? "No one has enough points"
                : "Select member"}
            </option>
            {eligible.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.memberName} ({m.balance} pts)
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={!selectedId || pending}
          onClick={redeem}
        >
          {pending ? "Redeeming…" : "Redeem"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function DeleteRewardDialog({
  reward,
  onClose,
  onDeleted,
}: {
  reward: RewardRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteRewardFn({ data: { id: reward.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete reward.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{reward.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This also removes its redemption history.
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
