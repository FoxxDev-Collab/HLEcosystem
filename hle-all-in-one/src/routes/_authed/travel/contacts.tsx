import { Link, createFileRoute } from "@tanstack/react-router"
import { ChevronRight, Globe, Mail, MapPin, Phone, Users } from "lucide-react"
import { getContactsRollupFn } from "@/server/travel/fns.overview"
import { Card, CardContent } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/travel/contacts")({
  loader: () => getContactsRollupFn(),
  component: ContactsPage,
})

function ContactsPage() {
  const trips = Route.useLoaderData()
  const totalContacts = trips.reduce((sum, t) => sum + t.contacts.length, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Travel Contacts</h1>
        <p className="text-sm text-muted-foreground">
          {totalContacts} contact{totalContacts !== 1 ? "s" : ""} across{" "}
          {trips.length} trip{trips.length !== 1 ? "s" : ""}
        </p>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No contacts yet. Add them from a trip&apos;s detail page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {trips.map((trip) => (
            <div key={trip.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Link
                  to="/travel/trips/$id"
                  params={{ id: trip.id }}
                  search={{ tab: "contacts" }}
                  className="group flex items-center gap-1.5"
                >
                  <h2 className="text-sm font-semibold transition-colors group-hover:text-primary">
                    {trip.name}
                  </h2>
                  <ChevronRight className="size-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                </Link>
                <span className="text-xs text-muted-foreground">
                  {trip.contacts.length} contact
                  {trip.contacts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trip.contacts.map((c) => (
                  <div
                    key={c.id}
                    className="space-y-2 rounded-lg border border-border/40 bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.role && (
                        <p className="text-xs text-muted-foreground">
                          {c.role}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Phone className="size-3 shrink-0" />
                          <span>{c.phone}</span>
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </a>
                      )}
                      {c.address && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 size-3 shrink-0" />
                          <span>{c.address}</span>
                        </div>
                      )}
                      {c.website && (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Globe className="size-3 shrink-0" />
                          <span className="truncate">
                            {c.website.replace(/^https?:\/\//, "")}
                          </span>
                        </a>
                      )}
                    </div>
                    {c.notes && (
                      <p className="border-t border-border/30 pt-2 text-xs text-muted-foreground">
                        {c.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
