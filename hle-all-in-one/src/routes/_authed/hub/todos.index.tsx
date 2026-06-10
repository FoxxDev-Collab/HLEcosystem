import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { CheckCircle2, Circle, ListTodo, Plus } from "lucide-react"
import { createTodoListFn, listTodoListsFn } from "@/server/hub/fns.todos"
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

export const Route = createFileRoute("/_authed/hub/todos/")({
  loader: () => listTodoListsFn(),
  component: TodoListsPage,
})

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

function TodoListsPage() {
  const lists = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createTodoListFn({
        data: {
          name: String(f.get("name") ?? ""),
          description: null,
          color: String(f.get("color") ?? "") || null,
        },
      })
      // Legacy behavior: jump straight into the new list.
      router.navigate({
        to: "/hub/todos/$listId",
        params: { listId: result.id },
      })
    } catch {
      setError("Could not create list.")
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">To-Do Lists</h1>
          <p className="text-sm text-muted-foreground">
            Manage tasks for your household
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" />
            New List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onCreate}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="list-name">Name</Label>
              <Input
                id="list-name"
                name="name"
                placeholder="e.g. Weekend Chores, Grocery Run..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <label key={color} className="cursor-pointer">
                    <input
                      type="radio"
                      name="color"
                      value={color}
                      className="peer sr-only"
                    />
                    <div
                      className="size-7 rounded-full border-2 border-transparent transition-all peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-foreground/20 peer-checked:ring-offset-2 peer-checked:ring-offset-background"
                      style={{ backgroundColor: color }}
                    />
                  </label>
                ))}
              </div>
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              {pending ? "Creating…" : "Create"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/30 p-16 text-center">
          <ListTodo className="size-16 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">No lists yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a to-do list above to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => {
            const progress =
              list.totalCount > 0
                ? Math.round((list.doneCount / list.totalCount) * 100)
                : 0
            return (
              <Link
                key={list.id}
                to="/hub/todos/$listId"
                params={{ listId: list.id }}
              >
                <Card className="h-full transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: list.color || "#6b7280" }}
                      />
                      <CardTitle className="text-base">{list.name}</CardTitle>
                    </div>
                    {list.description && (
                      <CardDescription className="line-clamp-2">
                        {list.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Circle className="size-3" />
                          {list.totalCount - list.doneCount} pending
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          {list.doneCount} done
                        </span>
                      </div>
                      {list.totalCount > 0 && (
                        <Badge
                          variant={progress === 100 ? "default" : "secondary"}
                        >
                          {progress}%
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
