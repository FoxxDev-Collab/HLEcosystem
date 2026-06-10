import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/travel/reservations")({
  component: () => <ModulePlaceholder title="Travel" />,
})
