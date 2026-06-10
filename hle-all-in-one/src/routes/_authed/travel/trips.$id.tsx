import {
  Link,
  createFileRoute,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { getTripDetailFn } from "@/server/travel/fns.detail"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateRange } from "@/components/travel/trip-shared"
import { TripOverviewTab } from "@/components/travel/trip-overview-tab"
import { TripItineraryTab } from "@/components/travel/trip-itinerary-tab"
import { TripReservationsTab } from "@/components/travel/trip-reservations-tab"
import { TripPackingTab } from "@/components/travel/trip-packing-tab"
import { TripBudgetTab } from "@/components/travel/trip-budget-tab"
import { TripContactsTab } from "@/components/travel/trip-contacts-tab"

const TABS = [
  "overview",
  "itinerary",
  "reservations",
  "packing",
  "budget",
  "contacts",
] as const

type TabKey = (typeof TABS)[number]

type TripDetailSearch = { tab?: TabKey }

export const Route = createFileRoute("/_authed/travel/trips/$id")({
  // Deep links like /travel/trips/:id?tab=packing land on the right tab.
  validateSearch: (search: Record<string, unknown>): TripDetailSearch => {
    const tab = TABS.find((t) => t === search.tab)
    return tab && tab !== "overview" ? { tab } : {}
  },
  loader: async ({ params }) => {
    const data = await getTripDetailFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: TripDetailPage,
})

function TripDetailPage() {
  const data = Route.useLoaderData()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const { trip } = data

  function refresh() {
    router.invalidate()
  }

  function setTab(value: TabKey) {
    navigate({
      search: value === "overview" ? {} : { tab: value },
      replace: true,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link to="/travel/trips" />}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{trip.name}</h1>
          <p className="text-sm text-muted-foreground">
            {trip.destination && `${trip.destination} · `}
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>
        </div>
      </div>

      <Tabs
        value={tab ?? "overview"}
        onValueChange={(value) => {
          const next = TABS.find((t) => t === value)
          if (next) setTab(next)
        }}
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="packing">Packing</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TripOverviewTab
            trip={trip}
            travelers={data.travelers}
            members={data.members}
            onChanged={refresh}
            onDeleted={() => navigate({ to: "/travel/trips" })}
          />
        </TabsContent>
        <TabsContent value="itinerary">
          <TripItineraryTab
            tripId={trip.id}
            startDate={trip.startDate}
            endDate={trip.endDate}
            days={data.itineraryDays}
            onChanged={refresh}
          />
        </TabsContent>
        <TabsContent value="reservations">
          <TripReservationsTab
            tripId={trip.id}
            reservations={data.reservations}
            onChanged={refresh}
          />
        </TabsContent>
        <TabsContent value="packing">
          <TripPackingTab
            tripId={trip.id}
            packingLists={data.packingLists}
            onChanged={refresh}
          />
        </TabsContent>
        <TabsContent value="budget">
          <TripBudgetTab
            tripId={trip.id}
            budgetItems={data.budgetItems}
            onChanged={refresh}
          />
        </TabsContent>
        <TabsContent value="contacts">
          <TripContactsTab
            tripId={trip.id}
            contacts={data.contacts}
            onChanged={refresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
