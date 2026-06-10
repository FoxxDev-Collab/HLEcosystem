import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  CheckCircle,
  ChefHat,
  Database,
  RefreshCw,
  Unplug,
  XCircle,
} from "lucide-react"
import {
  disconnectMealieFn,
  getMealsSettingsFn,
  saveMealieConfigFn,
  syncMealieNowFn,
  testMealieConnectionFn,
} from "@/server/meals/fns.settings"
import { formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export const Route = createFileRoute("/_authed/meals/settings")({
  loader: () => getMealsSettingsFn(),
  component: MealsSettingsPage,
})

function MealsSettingsPage() {
  const { config, syncState } = Route.useLoaderData()
  const router = useRouter()
  const [apiUrl, setApiUrl] = useState(config?.apiUrl ?? "")
  const [apiToken, setApiToken] = useState("")
  const [message, setMessage] = useState<{
    kind: "ok" | "error"
    text: string
  } | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    if (!apiUrl.trim() || !apiToken.trim()) {
      setMessage({
        kind: "error",
        text: "Both the Mealie URL and an API token are required to save.",
      })
      return
    }
    setPending("save")
    try {
      const result = await saveMealieConfigFn({
        data: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      })
      if ("error" in result && typeof result.error === "string") {
        setMessage({ kind: "error", text: result.error })
      } else {
        setMessage({ kind: "ok", text: "Connected to Mealie." })
        setApiToken("")
      }
      router.invalidate()
    } catch {
      setMessage({ kind: "error", text: "Could not save the connection." })
    }
    setPending(null)
  }

  async function onTest() {
    setMessage(null)
    setPending("test")
    try {
      const result = await testMealieConnectionFn({
        data: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      })
      if ("error" in result && typeof result.error === "string") {
        setMessage({
          kind: "error",
          text: `Connection failed: ${result.error}`,
        })
      } else {
        setMessage({ kind: "ok", text: "Connection test successful." })
      }
    } catch {
      setMessage({ kind: "error", text: "Connection test failed." })
    }
    setPending(null)
  }

  async function onSyncNow() {
    setMessage(null)
    setPending("sync")
    try {
      const result = await syncMealieNowFn()
      if ("error" in result && typeof result.error === "string") {
        setMessage({ kind: "error", text: result.error })
      } else if ("recipes" in result) {
        setMessage({
          kind: "ok",
          text: `Synced ${result.recipes} recipes and ${result.planEntries} meal plan entries.`,
        })
      }
      router.invalidate()
    } catch {
      setMessage({ kind: "error", text: "Sync failed." })
    }
    setPending(null)
  }

  async function onDisconnect() {
    setPending("disconnect")
    try {
      await disconnectMealieFn()
      setDisconnectOpen(false)
      setApiUrl("")
      setApiToken("")
      setMessage(null)
      router.invalidate()
    } catch {
      setMessage({ kind: "error", text: "Could not disconnect." })
    }
    setPending(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Meals module integrations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="size-5" />
            Mealie Integration
          </CardTitle>
          <CardDescription>
            Connect your Mealie instance to sync meal plan ingredients into
            shopping lists. Each household has its own Mealie connection — your
            API key is not shared with other households.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              {config.isActive ? (
                <>
                  <CheckCircle className="size-5 shrink-0 text-green-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Connected</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {config.apiUrl}
                      {config.hasToken && " · API token stored"}
                    </div>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </>
              ) : (
                <>
                  <XCircle className="size-5 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Connection Failed</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {config.apiUrl} — check your URL and API token
                    </div>
                  </div>
                  <Badge variant="destructive">Inactive</Badge>
                </>
              )}
            </div>
          )}

          {message && (
            <p
              className={
                message.kind === "ok"
                  ? "text-sm text-green-600 dark:text-green-400"
                  : "text-sm text-destructive"
              }
            >
              {message.text}
            </p>
          )}

          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">Mealie URL</Label>
              <Input
                id="apiUrl"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://mealie.example.com"
              />
              <p className="text-xs text-muted-foreground">
                The full URL to your Mealie instance (no trailing slash)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={
                  config?.hasToken
                    ? "•••••••••••••••• (stored — enter a new token to replace)"
                    : "Paste your Mealie API token"
                }
              />
              <p className="text-xs text-muted-foreground">
                Generate a token in Mealie: User Profile → API Tokens → Create
                Token. Tokens are stored server-side and never shown again.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending !== null}>
                {pending === "save"
                  ? "Saving…"
                  : config
                    ? "Update Connection"
                    : "Connect to Mealie"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending !== null}
                onClick={onTest}
              >
                {pending === "test" ? "Testing…" : "Test Connection"}
              </Button>
            </div>
          </form>

          {config?.isActive && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Database className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Local cache:</span>
                  {syncState?.recipesSyncedAt ? (
                    <span className="font-medium">
                      {syncState.recipeTotalCount} recipes · last synced{" "}
                      {formatDateTime(syncState.recipesSyncedAt)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Not synced yet
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending !== null}
                  onClick={onSyncNow}
                >
                  <RefreshCw className="size-3.5" />
                  {pending === "sync" ? "Syncing…" : "Sync Now"}
                </Button>
              </div>
            </div>
          )}

          {config && (
            <div className="border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDisconnectOpen(true)}
              >
                <Unplug className="size-3.5" />
                Disconnect Mealie
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {disconnectOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDisconnectOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Mealie?</AlertDialogTitle>
              <AlertDialogDescription>
                The stored URL and API token are deleted. Cached recipes stay
                until the next sync.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDisconnectOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  onDisconnect()
                }}
                disabled={pending !== null}
              >
                {pending === "disconnect" ? "Disconnecting…" : "Disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
