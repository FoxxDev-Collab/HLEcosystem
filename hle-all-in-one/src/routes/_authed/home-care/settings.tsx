import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/home-care/settings")({
  component: HomeCareSettingsPage,
})

function HomeCareSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Preferences for the Home Care module.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Home Care Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Module settings coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
