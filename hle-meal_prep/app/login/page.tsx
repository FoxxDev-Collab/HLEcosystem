import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUsers } from "@/lib/users";
import { selectUserAction } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function LoginPage() {
  const currentUser = await getCurrentUser();
  if (currentUser) redirect("/dashboard");

  const users = await getUsers();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Grocery Planner</CardTitle>
          <CardDescription>Select your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No users found. Create users in Family Manager first.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <form key={user.id} action={selectUserAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </Button>
                </form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
