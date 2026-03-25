import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addApiKeyAction, toggleApiKeyAction, deleteApiKeyAction } from "./actions";

export default async function ApiKeysPage() {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { usageLogs: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">Manage your Anthropic API keys</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add API Key</CardTitle>
          <CardDescription>
            Add your Anthropic API key. The key will be hashed and only the prefix shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addApiKeyAction} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Primary" required />
            </div>
            <div className="flex-[2] space-y-1">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" name="apiKey" type="password" placeholder="sk-ant-..." required />
            </div>
            <div className="flex items-end">
              <Button type="submit">Add Key</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No API keys configured</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm">{key.keyPrefix}...</TableCell>
                    <TableCell>
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                    </TableCell>
                    <TableCell className="text-sm">{key._count.usageLogs}</TableCell>
                    <TableCell className="text-sm">{formatDate(key.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <form action={toggleApiKeyAction}>
                          <input type="hidden" name="keyId" value={key.id} />
                          <Button type="submit" variant="outline" size="sm">
                            {key.isActive ? "Disable" : "Enable"}
                          </Button>
                        </form>
                        <form action={deleteApiKeyAction}>
                          <input type="hidden" name="keyId" value={key.id} />
                          <Button type="submit" variant="destructive" size="sm">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
