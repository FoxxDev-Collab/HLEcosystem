import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/meals/recipes/what-can-i-cook")({
  component: () => <ModulePlaceholder title="Meals" />,
})
