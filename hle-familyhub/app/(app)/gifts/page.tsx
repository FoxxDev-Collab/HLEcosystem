import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatCurrency } from "@/lib/format";
import { createGiftAction, updateGiftStatusAction, deleteGiftAction } from "./actions";

const GIFT_STATUSES = ["IDEA", "PURCHASED", "WRAPPED", "GIVEN"];

const STATUS_COLORS: Record<string, string> = {
  IDEA: "bg-gray-100 text-gray-700",
  PURCHASED: "bg-blue-100 text-blue-700",
  WRAPPED: "bg-yellow-100 text-yellow-700",
  GIVEN: "bg-green-100 text-green-700",
};

function renderRating(rating: number | null): string {
  if (!rating) return "";
  return Array(5).fill(0).map((_, i) => i < rating ? "\u2605" : "\u2606").join("");
}

export default async function GiftsPage() {
  const householdId = (await getCurrentHouseholdId())!;

  const [gifts, familyMembers] = await Promise.all([
    prisma.gift.findMany({
      where: { householdId },
      include: { familyMember: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.familyMember.findMany({
      where: { householdId, isActive: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const totalCost = gifts.reduce((sum, g) => {
    const cost = g.actualCost ? Number(g.actualCost) : g.estimatedCost ? Number(g.estimatedCost) : 0;
    return sum + cost;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gift History</h1>
        <Badge variant="outline" className="text-base">
          Total: {formatCurrency(totalCost)}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Gift</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createGiftAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="familyMemberId">Family Member *</Label>
                <select id="familyMemberId" name="familyMemberId" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">Select...</option>
                  {familyMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Input id="description" name="description" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occasion">Occasion</Label>
                <Input id="occasion" name="occasion" placeholder="e.g. Birthday, Christmas" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="giftDate">Gift Date</Label>
                <Input id="giftDate" name="giftDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedCost">Estimated Cost</Label>
                <Input id="estimatedCost" name="estimatedCost" type="number" step="0.01" min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualCost">Actual Cost</Label>
                <Input id="actualCost" name="actualCost" type="number" step="0.01" min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" defaultValue="IDEA" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {GIFT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Rating (1-5)</Label>
                <Input id="rating" name="rating" type="number" min="1" max="5" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <Button type="submit">Add Gift</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {gifts.map((gift) => (
          <Card key={gift.id}>
            <CardContent className="flex items-center justify-between pt-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{gift.description}</p>
                  <Badge className={STATUS_COLORS[gift.status]}>{gift.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  For {gift.familyMember.firstName} {gift.familyMember.lastName}
                  {gift.occasion && ` - ${gift.occasion}`}
                  {gift.giftDate && ` - ${formatDate(gift.giftDate)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {gift.actualCost ? formatCurrency(gift.actualCost.toString()) : gift.estimatedCost ? `~${formatCurrency(gift.estimatedCost.toString())}` : ""}
                  {gift.rating ? ` ${renderRating(gift.rating)}` : ""}
                  {gift.notes ? ` - ${gift.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {gift.status !== "GIVEN" && (
                  <form action={updateGiftStatusAction}>
                    <input type="hidden" name="id" value={gift.id} />
                    <input type="hidden" name="status" value={
                      gift.status === "IDEA" ? "PURCHASED" : gift.status === "PURCHASED" ? "WRAPPED" : "GIVEN"
                    } />
                    <Button type="submit" variant="outline" size="sm">
                      {gift.status === "IDEA" ? "Mark Purchased" : gift.status === "PURCHASED" ? "Mark Wrapped" : "Mark Given"}
                    </Button>
                  </form>
                )}
                <form action={deleteGiftAction}>
                  <input type="hidden" name="id" value={gift.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-red-600">Delete</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {gifts.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No gifts recorded yet. Add one above.</p>
      )}
    </div>
  );
}
