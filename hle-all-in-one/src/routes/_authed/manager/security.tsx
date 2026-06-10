import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Monitor } from "lucide-react"
import {
  changePasswordFn,
  getMySessionsFn,
  revokeSessionFn,
} from "@/server/fns.account"
import { passwordIsValid } from "@/lib/password"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordField } from "@/components/password-field"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/_authed/manager/security")({
  loader: () => getMySessionsFn(),
  component: SecurityPage,
})

function SecurityPage() {
  const { sessions } = Route.useLoaderData()
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">
          Manage your password and active sessions.
        </p>
      </div>

      <ChangePasswordCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active sessions</CardTitle>
          <CardDescription>
            Devices currently signed in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Signed in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-[240px] truncate">
                    <span className="flex items-center gap-2">
                      <Monitor className="size-4 text-muted-foreground" />
                      {s.userAgent ?? "Unknown device"}
                      {s.current && <Badge variant="outline">This device</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!s.current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await revokeSessionFn({ data: { id: s.id } })
                          router.invalidate()
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setOk(false)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await changePasswordFn({
        data: {
          currentPassword: String(f.get("current") ?? ""),
          newPassword,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      setOk(true)
      setPending(false)
      setNewPassword("")
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <PasswordField
            id="next"
            name="next"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {ok && <p className="text-sm text-emerald-600">Password updated.</p>}
          <Button type="submit" disabled={pending || !passwordIsValid(newPassword)}>
            {pending ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
