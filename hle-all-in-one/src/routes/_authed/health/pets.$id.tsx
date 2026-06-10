import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/health/pets/$id")({
  component: () => <ModulePlaceholder title="Health" />,
})
