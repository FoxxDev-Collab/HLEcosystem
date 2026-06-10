import { useState } from "react"
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { updateProfileFn } from "@/server/fns.account"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const authed = getRouteApi("/_authed")

export const Route = createFileRoute("/_authed/manager/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = authed.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setOk(false)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await updateProfileFn({
        data: {
          firstName: String(f.get("firstName") ?? "").trim(),
          lastName: String(f.get("lastName") ?? "").trim(),
          email: String(f.get("email") ?? ""),
        },
      })
      if ("error" in result && result.error) {
        setError(result.error)
        setPending(false)
        return
      }
      setOk(true)
      setPending(false)
      router.invalidate()
    } catch {
      setError("Could not save profile.")
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your account profile.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Signed in as {user.role === "ADMIN" ? "an admin" : "a member"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="max-w-sm space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="s-first">First name</Label>
                <Input id="s-first" name="firstName" defaultValue={user.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-last">Last name</Label>
                <Input id="s-last" name="lastName" defaultValue={user.lastName} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <Input
                id="s-email"
                name="email"
                type="email"
                defaultValue={user.email}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {ok && <p className="text-sm text-emerald-600">Profile saved.</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
