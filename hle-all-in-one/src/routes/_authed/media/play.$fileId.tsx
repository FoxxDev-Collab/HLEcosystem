import { createFileRoute, notFound } from "@tanstack/react-router"
import { Player } from "@/components/media/player"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The streaming endpoint re-validates everything (session, household scope,
// parental gate) — this page only needs a well-formed file id to point the
// <video> element at.
export const Route = createFileRoute("/_authed/media/play/$fileId")({
  loader: ({ params }) => {
    if (!UUID_RE.test(params.fileId)) throw notFound()
    return { fileId: params.fileId }
  },
  component: PlayPage,
})

function PlayPage() {
  const { fileId } = Route.useLoaderData()
  return <Player fileId={fileId} />
}
