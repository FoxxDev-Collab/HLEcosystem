import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { createImportantDateAction, deleteImportantDateAction } from "./actions";

const DATE_TYPES = ["BIRTHDAY", "ANNIVERSARY", "GRADUATION", "MEMORIAL", "HOLIDAY", "CUSTOM"];
const RECURRENCE_TYPES = ["ONCE", "ANNUAL"];

const DATE_TYPE_COLORS: Record<string, string> = {
  BIRTHDAY: "bg-blue-100 text-blue-700",
  ANNIVERSARY: "bg-pink-100 text-pink-700",
  GRADUATION: "bg-purple-100 text-purple-700",
  MEMORIAL: "bg-gray-100 text-gray-700",
  HOLIDAY: "bg-green-100 text-green-700",
  CUSTOM: "bg-orange-100 text-orange-700",
};

function getNextOccurrence(date: Date, recurrenceType: string): Date {
  if (recurrenceType === "ONCE") return new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(date);
  next.setFullYear(today.getFullYear());
  if (next < today) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return next;
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ImportantDatesPage() {
  const householdId = (await getCurrentHouseholdId())!;

  const [dates, familyMembers] = await Promise.all([
    prisma.importantDate.findMany({
      where: { householdId },
      include: { familyMember: true },
    }),
    prisma.familyMember.findMany({
      where: { householdId, isActive: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const sortedDates = dates
    .map((d) => {
      const nextDate = getNextOccurrence(d.date, d.recurrenceType);
      const days = daysUntil(nextDate);
      return { ...d, nextDate, days };
    })
    .sort((a, b) => a.days - b.days);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Important Dates</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Important Date</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createImportantDateAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input id="label" name="label" placeholder="e.g. Mom's Birthday" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <select id="type" name="type" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {DATE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrenceType">Recurrence</Label>
                <select id="recurrenceType" name="recurrenceType" defaultValue="ANNUAL" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {RECURRENCE_TYPES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminderDaysBefore">Reminder (days before)</Label>
                <Input id="reminderDaysBefore" name="reminderDaysBefore" type="number" defaultValue={14} min={0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="familyMemberId">Family Member (optional)</Label>
                <select id="familyMemberId" name="familyMemberId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">None</option>
                  {familyMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <Button type="submit">Add Date</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sortedDates.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex items-center justify-between pt-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{d.label}</p>
                  <Badge className={DATE_TYPE_COLORS[d.type]}>{d.type}</Badge>
                  {d.recurrenceType === "ANNUAL" && <Badge variant="outline">Annual</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(d.nextDate)}
                  {d.familyMember && ` - ${d.familyMember.firstName} ${d.familyMember.lastName}`}
                </p>
                {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={d.days === 0 ? "destructive" : d.days <= 7 ? "default" : "secondary"}>
                  {d.days === 0 ? "Today!" : d.days < 0 ? "Passed" : `${d.days} days`}
                </Badge>
                <form action={deleteImportantDateAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-red-600">Delete</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sortedDates.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No important dates yet. Add one above.</p>
      )}
    </div>
  );
}
