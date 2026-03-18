import {
  getCurrentHouseholdId,
  getAllHouseholds,
} from "@/lib/household";
import {
  formatRelationship,
  FAMILY_RELATIONSHIPS,
} from "@/lib/relationships";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { linkHouseholdAction, unlinkHouseholdAction } from "./actions";

export default async function LinkedHouseholdsPage() {
  const householdId = (await getCurrentHouseholdId())!;

  const [linkedHouseholds, allHouseholds] = await Promise.all([
    prisma.linkedHousehold.findMany({
      where: { householdId },
      orderBy: { createdAt: "desc" },
    }),
    getAllHouseholds(),
  ]);

  const householdMap = new Map(allHouseholds.map((h) => [h.id, h]));
  const linkedIds = new Set(
    linkedHouseholds.map((lh) => lh.linkedHouseholdId)
  );
  const availableHouseholds = allHouseholds.filter(
    (h) => h.id !== householdId && !linkedIds.has(h.id)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Linked Families</h1>

      {availableHouseholds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Link a Household</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={linkHouseholdAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="linkedHouseholdId">Household</Label>
                  <select
                    id="linkedHouseholdId"
                    name="linkedHouseholdId"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">Select a household...</option>
                    {availableHouseholds.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship</Label>
                  <select
                    id="relationship"
                    name="relationship"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">Select relationship...</option>
                    {FAMILY_RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {formatRelationship(rel)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Label (optional override)</Label>
                  <Input
                    id="label"
                    name="label"
                    placeholder="e.g. Parents, In-Laws, Siblings"
                  />
                </div>
              </div>
              <Button type="submit">Link Household</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {linkedHouseholds.map((lh) => {
          const linked = householdMap.get(lh.linkedHouseholdId);
          const displayLabel = lh.label
            || (lh.relationship ? formatRelationship(lh.relationship) : null)
            || "Linked Family";

          return (
            <Card key={lh.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {linked?.name ?? "Unknown Household"}
                    </p>
                    <Badge variant="outline">{displayLabel}</Badge>
                  </div>
                  {lh.notes && (
                    <p className="text-sm text-muted-foreground">{lh.notes}</p>
                  )}
                </div>
                <form action={unlinkHouseholdAction}>
                  <input type="hidden" name="id" value={lh.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                  >
                    Unlink
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {linkedHouseholds.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No linked households yet. Link one above to build your family network.
        </p>
      )}
    </div>
  );
}
