import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/home-care/rooms")({
  component: () => <ModulePlaceholder title="Home Care" />,
})
