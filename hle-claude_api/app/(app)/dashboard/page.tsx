import prisma from "@/lib/prisma";
import { isServiceEnabled } from "@/lib/service-config";
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

async function getStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayLogs, weekLogs, monthLogs, allTimeLogs, recentLogs] = await Promise.all([
    prisma.usageLog.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _count: true,
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
    }),
    prisma.usageLog.aggregate({
      where: { createdAt: { gte: startOfWeek } },
      _count: true,
      _sum: { estimatedCostUsd: true },
    }),
    prisma.usageLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _count: true,
      _sum: { estimatedCostUsd: true },
    }),
    prisma.usageLog.aggregate({
      _count: true,
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
    }),
    prisma.usageLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { todayLogs, weekLogs, monthLogs, allTimeLogs, recentLogs };
}

export default async function DashboardPage() {
  const [stats, enabled] = await Promise.all([getStats(), isServiceEnabled()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Claude API Gateway overview</p>
        </div>
        <Badge variant={enabled ? "default" : "destructive"}>
          {enabled ? "Service Enabled" : "Service Disabled"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(stats.todayLogs._count)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Number(stats.todayLogs._sum.estimatedCostUsd ?? 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Week</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(stats.weekLogs._count)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Number(stats.weekLogs._sum.estimatedCostUsd ?? 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Month</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(stats.monthLogs._count)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Number(stats.monthLogs._sum.estimatedCostUsd ?? 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>All Time</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(stats.allTimeLogs._count)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Number(stats.allTimeLogs._sum.estimatedCostUsd ?? 0))} total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Token Usage (All Time)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Input tokens</span>
              <span className="font-mono text-sm">{formatNumber(stats.allTimeLogs._sum.inputTokens ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Output tokens</span>
              <span className="font-mono text-sm">{formatNumber(stats.allTimeLogs._sum.outputTokens ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Usage (Today)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Input tokens</span>
              <span className="font-mono text-sm">{formatNumber(stats.todayLogs._sum.inputTokens ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Output tokens</span>
              <span className="font-mono text-sm">{formatNumber(stats.todayLogs._sum.outputTokens ?? 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription>Last 10 API calls</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No requests yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{formatDatetime(log.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.requestingApp}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.endpoint.replace("/api/v1/", "")}</TableCell>
                    <TableCell className="font-mono text-xs">{formatNumber(log.totalTokens)}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
