import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/home-care/chores/rewards")({
  component: () => <ModulePlaceholder title="Home Care" />,
})
