import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Phone, Mail, Globe, MapPin, ChevronRight } from "lucide-react";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) notFound();

  const trips = await prisma.trip.findMany({
    where: { householdId, contacts: { some: {} } },
    orderBy: { startDate: "asc" },
    include: {
      contacts: { orderBy: { sortOrder: "asc" } },
    },
  });

  const totalContacts = trips.reduce((sum, t) => sum + t.contacts.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Travel Contacts</h1>
        <p className="text-muted-foreground">
          {totalContacts} contact{totalContacts !== 1 ? "s" : ""} across {trips.length} trip{trips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No contacts yet. Add them from a trip&apos;s detail page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {trips.map((trip) => (
            <div key={trip.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Link href={`/trips/${trip.id}`} className="group flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{trip.name}</h2>
                  <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </Link>
                <span className="text-xs text-muted-foreground">{trip.contacts.length} contact{trip.contacts.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trip.contacts.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/40 bg-card p-4 space-y-2">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                    </div>
                    <div className="space-y-1">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Phone className="size-3 shrink-0" />
                          <span>{c.phone}</span>
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </a>
                      )}
                      {c.address && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <MapPin className="size-3 shrink-0 mt-0.5" />
                          <span>{c.address}</span>
                        </div>
                      )}
                      {c.website && (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Globe className="size-3 shrink-0" />
                          <span className="truncate">{c.website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      )}
                    </div>
                    {c.notes && (
                      <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">{c.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
