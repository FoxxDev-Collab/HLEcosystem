import { useState } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Home, KeyRound, ShieldCheck, UserRound } from "lucide-react"
import { completeSetupFn, getSetupStatusFn } from "@/server/fns.setup"
import { passwordIsValid } from "@/lib/password"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordField } from "@/components/password-field"

// First-run setup wizard. Only reachable while the instance has no users —
// afterwards the loader bounces straight to /login (and the server fn behind
// the final submit re-checks, so the redirect is cosmetic, not the guard).
export const Route = createFileRoute("/setup")({
  loader: async () => {
    const { needsSetup } = await getSetupStatusFn()
    if (!needsSetup) throw redirect({ to: "/login" })
    return {}
  },
  component: SetupWizard,
})

const STEPS = [
  { icon: ShieldCheck, label: "Verify" },
  { icon: UserRound, label: "Admin account" },
  { icon: Home, label: "Household" },
] as const

function SetupWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Collected across steps, submitted once at the end.
  const [token, setToken] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [householdName, setHouseholdName] = useState("")

  async function finish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const result = await completeSetupFn({
        data: {
          token: token.trim(),
          email,
          firstName,
          lastName,
          password,
          householdName,
        },
      })
      if ("error" in result && result.error) {
        setError(result.error)
        setPending(false)
        return
      }
      await navigate({ to: "/" })
    } catch {
      setError("Something went wrong. Please try again.")
      setPending(false)
    }
  }

  const adminValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.includes("@") &&
    passwordIsValid(password)

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle>Set up HLEcosystem</CardTitle>
          <CardDescription>
            First run — create the administrator and your first household.
          </CardDescription>
          <ol className="flex items-center justify-center gap-2 pt-1">
            {STEPS.map((s, i) => (
              <li
                key={s.label}
                aria-current={i === step ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <s.icon className="size-3.5" />
                {s.label}
              </li>
            ))}
          </ol>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                setStep(1)
              }}
            >
              <p className="text-sm text-muted-foreground">
                To prove you own this server, enter the setup token from the
                server logs:
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
                podman logs hle-aio | grep -A2 "First-run setup"
              </pre>
              <div className="space-y-2">
                <Label htmlFor="s-token">Setup token</Label>
                <div className="relative">
                  <KeyRound className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="s-token"
                    className="pl-9 font-mono"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoComplete="off"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={!token.trim()}>
                Continue
              </Button>
            </form>
          )}

          {step === 1 && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                setStep(2)
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="s-first">First name</Label>
                  <Input
                    id="s-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-last">Last name</Label>
                  <Input
                    id="s-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">Email</Label>
                <Input
                  id="s-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <PasswordField
                id="s-password"
                name="password"
                label="Password"
                value={password}
                onChange={setPassword}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(0)}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={!adminValid}>
                  Continue
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-4" onSubmit={finish}>
              <p className="text-sm text-muted-foreground">
                Name your household — every module scopes its data to a
                household, and you can add more later in Manager.
              </p>
              <div className="space-y-2">
                <Label htmlFor="s-household">Household name</Label>
                <Input
                  id="s-household"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="e.g. The Price Family"
                  required
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={pending || !householdName.trim()}
                >
                  {pending ? "Setting up…" : "Finish setup"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
