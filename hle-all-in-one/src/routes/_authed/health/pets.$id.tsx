import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { getPetFn } from "@/server/health/fns.pets"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SPECIES_LABELS } from "@/components/health/health-shared"
import { PetProfileTab } from "@/components/health/pet-profile-tab"
import { PetVaccinationsTab } from "@/components/health/pet-vaccinations-tab"
import { PetMedicationsTab } from "@/components/health/pet-medications-tab"
import { PetAppointmentsTab } from "@/components/health/pet-appointments-tab"
import { PetConditionsTab } from "@/components/health/pet-conditions-tab"
import { PetInsuranceTab } from "@/components/health/pet-insurance-tab"

export const Route = createFileRoute("/_authed/health/pets/$id")({
  loader: async ({ params }) => {
    const data = await getPetFn({ data: { id: params.id } })
    if (!data) throw notFound()
    return data
  },
  component: PetDetailPage,
})

function PetDetailPage() {
  const {
    pet,
    vaccinations,
    medications,
    appointments,
    conditions,
    insurances,
    vetProviders,
  } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link to="/health/pets" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{pet.name}</h1>
          <p className="text-sm text-muted-foreground">
            {SPECIES_LABELS[pet.species]}
            {pet.breed && ` · ${pet.breed}`}
            {pet.gender && ` · ${pet.gender}`}
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="w-full min-w-max justify-start">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
            <TabsTrigger value="medications">Medications</TabsTrigger>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <PetProfileTab
            pet={pet}
            onChanged={refresh}
            onDeleted={() => navigate({ to: "/health/pets" })}
          />
        </TabsContent>
        <TabsContent value="vaccinations">
          <PetVaccinationsTab
            petId={pet.id}
            vaccinations={vaccinations}
            vetProviders={vetProviders}
            onChanged={refresh}
          />
        </TabsContent>
        <TabsContent value="medications">
          <PetMedicationsTab
            petId={pet.id}
            medications={medications}
            onChanged={refresh}
          />
        </TabsContent>
        <TabsContent value="appointments">
          <PetAppointmentsTab
            petId={pet.id}
            appointments={appointments}
            vetProviders={vetProviders}
            onChanged={refresh}
          />
        </TabsContent>
        <TabsContent value="conditions">
          <PetConditionsTab
            petId={pet.id}
            conditions={conditions}
            onChanged={refresh}
          />
        </TabsContent>
        <TabsContent value="insurance">
          <PetInsuranceTab
            petId={pet.id}
            insurances={insurances}
            onChanged={refresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
