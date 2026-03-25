import prisma from "@/lib/prisma";
import { formatCurrency, formatNumber, formatDatetime, formatDuration } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function UsagePage() {
  const [logs, appSummary] = await Promise.all([
    prisma.usageLog.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.usageLog.groupBy({
      by: ["requestingApp"],
      _count: true,
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground">Detailed usage logs and cost breakdown</p>
      </div>

      {appSummary.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {appSummary.map((app) => (
            <Card key={app.requestingApp}>
              <CardHeader className="pb-2">
                <CardDescription>{app.requestingApp}</CardDescription>
                <CardTitle className="text-xl">
                  {formatCurrency(Number(app._sum.estimatedCostUsd ?? 0))}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(app._count)} requests &middot;{" "}
                  {formatNumber((app._sum.inputTokens ?? 0) + (app._sum.outputTokens ?? 0))} tokens
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Request Log</CardTitle>
          <CardDescription>Last 50 API calls</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No usage data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Output</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDatetime(log.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.requestingApp}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.endpoint.replace("/api/v1/", "")}</TableCell>
                      <TableCell className="text-xs">{log.model.replace("claude-", "")}</TableCell>
                      <TableCell className="font-mono text-xs">{formatNumber(log.inputTokens)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatNumber(log.outputTokens)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCurrency(Number(log.estimatedCostUsd))}</TableCell>
                      <TableCell className="text-xs">{formatDuration(log.durationMs)}</TableCell>
                      <TableCell>
                        <Badge variant={log.statusCode === 200 ? "default" : "destructive"}>
                          {log.statusCode}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
