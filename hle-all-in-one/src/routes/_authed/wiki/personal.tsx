import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/wiki/personal")({
  component: () => <ModulePlaceholder title="Wiki" />,
})
