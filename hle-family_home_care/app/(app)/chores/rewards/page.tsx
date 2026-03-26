import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Star,
  Trophy,
  Gift,
} from "lucide-react";
import { createRewardAction, deleteRewardAction } from "../actions";
import { RedeemForm } from "@/components/redeem-form";

type HouseholdMember = {
  id: string;
  displayName: string;
};

export default async function RewardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [rewards, redemptions, members] = await Promise.all([
    prisma.choreReward.findMany({
      where: { householdId },
      orderBy: [{ isActive: "desc" }, { pointCost: "asc" }],
    }),
    prisma.rewardRedemption.findMany({
      where: { householdId },
      include: { reward: { select: { title: true } } },
      orderBy: { redeemedAt: "desc" },
      take: 50,
    }),
    prisma.$queryRaw<HouseholdMember[]>`
      SELECT hm."id", hm."displayName"
      FROM family_manager."HouseholdMember" hm
      WHERE hm."householdId" = ${householdId}
      ORDER BY hm."displayName"
    `,
  ]);

  // Calculate point balances for all members
  const memberBalances = await Promise.all(
    members.map(async (m) => {
      const earnedResult = await prisma.choreCompletion.aggregate({
        where: {
          householdId,
          completedById: m.id,
          status: "COMPLETED",
        },
        _sum: { pointsEarned: true },
      });
      const earned = earnedResult._sum.pointsEarned ?? 0;

      const spentResult = await prisma.rewardRedemption.aggregate({
        where: {
          householdId,
          redeemedById: m.id,
        },
        _sum: { pointsSpent: true },
      });
      const spent = spentResult._sum.pointsSpent ?? 0;

      return {
        id: m.id,
        name: m.displayName,
        earned,
        spent,
        balance: earned - spent,
      };
    })
  );

  const activeRewards = rewards.filter((r) => r.isActive);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Rewards</h1>

      {/* Points Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" /> Points Leaderboard
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
                {memberBalances
                  .sort((a, b) => b.earned - a.earned)
                  .map((m, idx) => (
                    <TableRow key={m.id}>
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
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {m.earned}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.spent}
                      </TableCell>
                      <TableCell className="text-right font-bold">{m.balance}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Reward */}
      <Card>
        <CardHeader>
          <CardTitle>Add Reward</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRewardAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Reward Name</Label>
              <Input name="title" placeholder="e.g. Movie Night Pick" required />
            </div>
            <div className="space-y-1">
              <Label>Point Cost</Label>
              <Input name="pointCost" type="number" min="1" placeholder="100" required />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label>Description</Label>
              <Input name="description" placeholder="Optional details" />
            </div>
            <Button type="submit">
              <Plus className="size-4 mr-2" />
              Add Reward
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Reward Catalog */}
      {rewards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Star className="size-10 mx-auto mb-3 opacity-40" />
            <p>No rewards defined yet. Add some above to motivate your household.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="size-5" /> Reward Catalog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeRewards.map((reward) => (
                <div
                  key={reward.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{reward.title}</h3>
                      {reward.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
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
                  />

                  <div className="flex justify-end">
                    <form action={deleteRewardAction}>
                      <input type="hidden" name="id" value={reward.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-xs text-red-500 h-7">
                        <Trash2 className="size-3 mr-1" />
                        Delete
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Redemption History */}
      {redemptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Redemption History</CardTitle>
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
                    <TableCell className="font-medium">{r.redeemedByName}</TableCell>
                    <TableCell>{r.reward.title}</TableCell>
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
    </div>
  );
}
