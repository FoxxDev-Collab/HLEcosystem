import Link from "next/link";
import { getCurrentHouseholdId, getHouseholdById, getAllHouseholds } from "@/lib/household";
import prisma from "@/lib/prisma";
import { FAMILY_RELATIONSHIPS, formatRelationship } from "@/lib/relationships";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, ArrowRight } from "lucide-react";
import { createRelationAction, deleteRelationAction } from "../actions";

export default async function ManageRelationsPage() {
  const householdId = (await getCurrentHouseholdId())!;

  // Fetch all households so we can connect members from any household
  const allHouseholds = await getAllHouseholds();

  // Fetch members from all households (for the dropdowns)
  const [allMembers, relations, currentHousehold] = await Promise.all([
    prisma.familyMember.findMany({
      where: { isActive: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.familyRelation.findMany({
      where: { householdId },
      include: {
        fromMember: { select: { id: true, firstName: true, lastName: true, householdId: true } },
        toMember: { select: { id: true, firstName: true, lastName: true, householdId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getHouseholdById(householdId),
  ]);

  // Build household name map
  const householdNameMap: Record<string, string> = {};
  for (const h of allHouseholds) {
    householdNameMap[h.id] = h.name;
  }
  if (currentHousehold) {
    householdNameMap[householdId] = currentHousehold.name;
  }

  // Group members by household for optgroup dropdowns
  const membersByHousehold = new Map<string, typeof allMembers>();
  for (const m of allMembers) {
    if (!membersByHousehold.has(m.householdId)) {
      membersByHousehold.set(m.householdId, []);
    }
    membersByHousehold.get(m.householdId)!.push(m);
  }

  // Current household first, then other households that have members (sorted by name)
  const otherHouseholdIds = allHouseholds
    .filter((h) => h.id !== householdId && membersByHousehold.has(h.id))
    .map((h) => h.id);
  const orderedHouseholdIds = [householdId, ...otherHouseholdIds].filter((id) => membersByHousehold.has(id));

  // Only show one direction per pair (A->B, skip B->A)
  const seen = new Set<string>();
  const uniqueRelations = relations.filter((r) => {
    const key = [r.fromMemberId, r.toMemberId].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/family-tree">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Manage Connections
          </h1>
          <p className="text-muted-foreground">
            Define how people in your family are related — across any household
          </p>
        </div>
      </div>

      {/* Add Connection Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Connection</CardTitle>
        </CardHeader>
        <CardContent>
          {allMembers.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              You need at least 2 people to create a connection.{" "}
              <Link href="/people" className="text-primary hover:underline">
                Add people first
              </Link>
              .
            </p>
          ) : (
            <form
              action={createRelationAction}
              className="flex flex-wrap items-end gap-4"
            >
              <div className="space-y-2 min-w-[180px]">
                <Label>Person A</Label>
                <select
                  name="fromMemberId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select...</option>
                  {orderedHouseholdIds.map((hId) => (
                    <optgroup key={hId} label={householdNameMap[hId] ?? "Unknown"}>
                      {(membersByHousehold.get(hId) ?? []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.firstName} {m.lastName}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="space-y-2 min-w-[160px]">
                <Label>is the ... of</Label>
                <select
                  name="relationType"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {FAMILY_RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>
                      {formatRelationship(r)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 min-w-[180px]">
                <Label>Person B</Label>
                <select
                  name="toMemberId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select...</option>
                  {orderedHouseholdIds.map((hId) => (
                    <optgroup key={hId} label={householdNameMap[hId] ?? "Unknown"}>
                      {(membersByHousehold.get(hId) ?? []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.firstName} {m.lastName}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <Button type="submit">
                <Plus className="size-4 mr-2" />
                Add
              </Button>
            </form>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            The inverse relationship is created automatically (e.g. adding
            &quot;Parent&quot; also creates &quot;Child&quot; in the other
            direction).
          </p>
        </CardContent>
      </Card>

      {/* Existing Connections */}
      <Card>
        <CardHeader>
          <CardTitle>
            Existing Connections{" "}
            <Badge variant="secondary" className="ml-2">
              {uniqueRelations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uniqueRelations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No connections yet. Add one above to start building your family
              tree.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person A</TableHead>
                  <TableHead className="text-center">Relationship</TableHead>
                  <TableHead>Person B</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueRelations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <span>{r.fromMember.firstName} {r.fromMember.lastName}</span>
                      {r.fromMember.householdId !== householdId && (
                        <Badge variant="secondary" className="ml-2 text-[10px] text-purple-700 dark:text-purple-400">
                          {householdNameMap[r.fromMember.householdId] ?? "Other"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline">
                          {formatRelationship(r.relationType)}
                        </Badge>
                        <ArrowRight className="size-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <span>{r.toMember.firstName} {r.toMember.lastName}</span>
                      {r.toMember.householdId !== householdId && (
                        <Badge variant="secondary" className="ml-2 text-[10px] text-purple-700 dark:text-purple-400">
                          {householdNameMap[r.toMember.householdId] ?? "Other"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <form action={deleteRelationAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
