import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/wiki/pages/$id/")({
  component: () => <ModulePlaceholder title="Wiki" />,
})
