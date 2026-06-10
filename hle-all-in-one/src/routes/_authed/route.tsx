import { Outlet, createFileRoute } from "@tanstack/react-router"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { getSessionContextFn } from "@/server/fns.auth"

// Authenticated shell. The loader resolves the real session + household context
// (getSessionContextFn redirects to /login if there is no valid session). The
// sidebar mounts once; modules render into <Outlet/>.
export const Route = createFileRoute("/_authed")({
  loader: () => getSessionContextFn(),
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user, households, activeHousehold } = Route.useLoaderData()

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        activeHousehold={activeHousehold}
        households={households}
      />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
