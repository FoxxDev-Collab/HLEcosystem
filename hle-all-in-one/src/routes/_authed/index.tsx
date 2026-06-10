import { createFileRoute, redirect } from "@tanstack/react-router"

// "/" → default landing module.
export const Route = createFileRoute("/_authed/")({
  beforeLoad: () => {
    throw redirect({ to: "/manager/dashboard" })
  },
})
