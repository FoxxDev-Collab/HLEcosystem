import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/meals/mealie/sync-review")({
  component: () => <ModulePlaceholder title="Meals" />,
})
