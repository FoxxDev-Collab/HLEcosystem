import prisma from "@/lib/prisma";

export type CalendarEvent = {
  id: string;
  date: Date;
  title: string;
  type: "maintenance" | "repair" | "warranty";
  entityName?: string;
  entityHref?: string;
};

export async function getCalendarEvents(
  householdId: string,
  year: number,
  month: number
): Promise<CalendarEvent[]> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const [schedules, repairs, items] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where: {
        householdId,
        isActive: true,
        nextDueDate: { gte: startDate, lte: endDate },
      },
      include: { item: true, vehicle: true },
    }),
    prisma.repair.findMany({
      where: {
        householdId,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledDate: { gte: startDate, lte: endDate },
      },
      include: { item: true, vehicle: true },
    }),
    prisma.item.findMany({
      where: {
        householdId,
        isArchived: false,
        warrantyExpires: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const events: CalendarEvent[] = [];

  for (const s of schedules) {
    if (!s.nextDueDate) continue;
    const entityName = s.item?.name ||
      (s.vehicle ? `${s.vehicle.year ? `${s.vehicle.year} ` : ""}${s.vehicle.make} ${s.vehicle.model}` : undefined);
    events.push({
      id: `schedule-${s.id}`,
      date: s.nextDueDate,
      title: s.title,
      type: "maintenance",
      entityName,
      entityHref: "/schedules",
    });
  }

  for (const r of repairs) {
    if (!r.scheduledDate) continue;
    const entityName = r.item?.name ||
      (r.vehicle ? `${r.vehicle.year ? `${r.vehicle.year} ` : ""}${r.vehicle.make} ${r.vehicle.model}` : undefined);
    events.push({
      id: `repair-${r.id}`,
      date: r.scheduledDate,
      title: r.title,
      type: "repair",
      entityName,
      entityHref: "/repairs",
    });
  }

  for (const item of items) {
    if (!item.warrantyExpires) continue;
    events.push({
      id: `warranty-${item.id}`,
      date: item.warrantyExpires,
      title: `${item.name} warranty expires`,
      type: "warranty",
      entityName: item.name,
      entityHref: `/items/${item.id}`,
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
