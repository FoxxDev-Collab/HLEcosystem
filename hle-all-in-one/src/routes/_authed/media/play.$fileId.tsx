import { createFileRoute } from "@tanstack/react-router"
import { ModulePlaceholder } from "@/components/module-placeholder"

export const Route = createFileRoute("/_authed/media/play/$fileId")({
  component: () => <ModulePlaceholder title="Media" />,
})
