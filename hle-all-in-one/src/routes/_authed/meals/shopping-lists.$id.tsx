import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/meals/shopping-lists/$id")({
  component: () => <ModulePlaceholder title="Meals" />,
})
