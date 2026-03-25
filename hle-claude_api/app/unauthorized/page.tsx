import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            The Claude API Gateway is restricted to administrators only.
          </p>
          <Button asChild variant="outline">
            <Link href={process.env.AUTH_URL || "http://localhost:8080"}>
              Return to Family Manager
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
