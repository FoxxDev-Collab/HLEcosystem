import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { createAppointmentAction, updateAppointmentStatusAction, deleteAppointmentAction } from "./actions";

const APPT_TYPES = [
  "ANNUAL_CHECKUP", "FOLLOW_UP", "SPECIALIST", "PROCEDURE", "LAB_WORK",
  "DENTAL", "VISION", "URGENT_CARE", "TELEHEALTH", "OTHER",
];

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  NO_SHOW: "bg-red-100 text-red-800",
  RESCHEDULED: "bg-yellow-100 text-yellow-800",
};

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const memberFilter = params.memberId ? { familyMemberId: params.memberId } : {};

  const [members, providers, appointments] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId, isActive: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.provider.findMany({
      where: { householdId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.appointment.findMany({
      where: { familyMember: { householdId }, ...memberFilter },
      include: { familyMember: true, provider: true },
      orderBy: { appointmentDateTime: "desc" },
      take: 50,
    }),
  ]);

  const now = new Date();
  const upcoming = appointments.filter((a) => a.status === "SCHEDULED" && a.appointmentDateTime >= now);
  const past = appointments.filter((a) => a.status !== "SCHEDULED" || a.appointmentDateTime < now);

  // Calendar data for current month
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const apptsByDay = new Map<number, typeof upcoming>();
  for (const appt of upcoming) {
    const d = appt.appointmentDateTime;
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      const day = d.getDate();
      const existing = apptsByDay.get(day) || [];
      existing.push(appt);
      apptsByDay.set(day, existing);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>

      {/* Create */}
      <Card>
        <CardHeader><CardTitle>Schedule Appointment</CardTitle></CardHeader>
        <CardContent>
          <form action={createAppointmentAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Family Member</Label>
              <Select name="familyMemberId" defaultValue={params.memberId || members[0]?.id} required>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="appointmentType" defaultValue="ANNUAL_CHECKUP">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input name="date" type="date" required />
            </div>
            <div className="space-y-1">
              <Label>Time</Label>
              <Input name="time" type="time" defaultValue="09:00" />
            </div>
            <div className="space-y-1">
              <Label>Provider</Label>
              <Select name="providerId">
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input name="location" placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input name="reasonForVisit" placeholder="Optional" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Schedule</Button>
          </form>
        </CardContent>
      </Card>

      {/* Calendar */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{now.toLocaleString("en-US", { month: "long", year: "numeric" })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="bg-background text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} className="bg-background min-h-[50px]" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayAppts = apptsByDay.get(day) || [];
                const isToday = day === now.getDate();
                return (
                  <div key={day} className={`bg-background min-h-[50px] p-1 ${isToday ? "ring-2 ring-blue-500 ring-inset" : ""}`}>
                    <div className={`text-xs font-medium ${isToday ? "text-blue-600" : ""}`}>{day}</div>
                    {dayAppts.map((a) => (
                      <div key={a.id} className="text-[10px] leading-tight truncate rounded px-0.5 mb-0.5 bg-blue-100 text-blue-700">
                        {a.familyMember.firstName}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Upcoming ({upcoming.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {upcoming.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <div className="text-sm font-medium">
                      {appt.familyMember.firstName} — {appt.appointmentType.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(appt.appointmentDateTime)} at {appt.appointmentDateTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {appt.provider && ` · ${appt.provider.name}`}
                      {appt.location && ` · ${appt.location}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <form action={updateAppointmentStatusAction}>
                      <input type="hidden" name="id" value={appt.id} />
                      <input type="hidden" name="status" value="COMPLETED" />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Mark Complete">
                        <CheckCircle2 className="size-3.5 text-green-600" />
                      </Button>
                    </form>
                    <form action={updateAppointmentStatusAction}>
                      <input type="hidden" name="id" value={appt.id} />
                      <input type="hidden" name="status" value="CANCELLED" />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Cancel">
                        <XCircle className="size-3.5 text-red-500" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past */}
      {past.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-muted-foreground">Past & Other ({past.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {past.slice(0, 20).map((appt) => (
                <div key={appt.id} className="flex items-center justify-between py-3 gap-4 opacity-70">
                  <div>
                    <div className="text-sm font-medium">
                      {appt.familyMember.firstName} — {appt.appointmentType.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(appt.appointmentDateTime)}
                      {appt.provider && ` · ${appt.provider.name}`}
                    </div>
                  </div>
                  <Badge className={STATUS_COLORS[appt.status] || ""} >{appt.status.replace(/_/g, " ")}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
