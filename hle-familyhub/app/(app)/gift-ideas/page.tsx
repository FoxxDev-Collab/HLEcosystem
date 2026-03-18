import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import {
  createGiftIdeaAction,
  markIdeaPurchasedAction,
  convertIdeaToGiftAction,
  deleteGiftIdeaAction,
} from "./actions";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PURCHASED: "bg-blue-100 text-blue-700",
  NOT_INTERESTED: "bg-gray-100 text-gray-700",
};

export default async function GiftIdeasPage() {
  const householdId = (await getCurrentHouseholdId())!;

  const [ideas, familyMembers] = await Promise.all([
    prisma.giftIdea.findMany({
      where: { householdId },
      include: { familyMember: true },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    }),
    prisma.familyMember.findMany({
      where: { householdId, isActive: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gift Ideas</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Gift Idea</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createGiftIdeaAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="idea">Idea *</Label>
                <Input id="idea" name="idea" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="familyMemberId">Family Member (optional)</Label>
                <select id="familyMemberId" name="familyMemberId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">General idea</option>
                  {familyMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input id="source" name="source" placeholder="Where you saw it" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select id="priority" name="priority" defaultValue="MEDIUM" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedCost">Estimated Cost</Label>
                <Input id="estimatedCost" name="estimatedCost" type="number" step="0.01" min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input id="url" name="url" type="url" placeholder="https://..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <Button type="submit">Add Idea</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {ideas.map((idea) => (
          <Card key={idea.id} className={idea.status !== "ACTIVE" ? "opacity-60" : ""}>
            <CardContent className="flex items-center justify-between pt-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{idea.idea}</p>
                  <Badge className={PRIORITY_COLORS[idea.priority]}>{idea.priority}</Badge>
                  <Badge className={STATUS_COLORS[idea.status]}>{idea.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {idea.familyMember && `For ${idea.familyMember.firstName} ${idea.familyMember.lastName}`}
                  {idea.estimatedCost ? ` - ${formatCurrency(idea.estimatedCost.toString())}` : ""}
                  {idea.source ? ` - Source: ${idea.source}` : ""}
                </p>
                {idea.url && (
                  <a href={idea.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    View Link
                  </a>
                )}
                {idea.notes && <p className="text-xs text-muted-foreground">{idea.notes}</p>}
              </div>
              {idea.status === "ACTIVE" && (
                <div className="flex items-center gap-2 shrink-0">
                  <form action={markIdeaPurchasedAction}>
                    <input type="hidden" name="id" value={idea.id} />
                    <Button type="submit" variant="outline" size="sm">Purchased</Button>
                  </form>
                  {idea.familyMemberId && (
                    <form action={convertIdeaToGiftAction}>
                      <input type="hidden" name="id" value={idea.id} />
                      <Button type="submit" variant="outline" size="sm">Convert to Gift</Button>
                    </form>
                  )}
                  <form action={deleteGiftIdeaAction}>
                    <input type="hidden" name="id" value={idea.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-red-600">Delete</Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {ideas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No gift ideas yet. Add one above.</p>
      )}
    </div>
  );
}
