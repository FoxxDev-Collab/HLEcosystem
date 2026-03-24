import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdById } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare, Share2, Tag, User } from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const household = await getHouseholdById(householdId);

  const [pageCount, commentCount, shareCount, tagCount] = await Promise.all([
    prisma.wikiPage.count({
      where: {
        archived: false,
        OR: [
          { ownerId: user.id },
          { ownerId: householdId },
          { createdBy: user.id },
        ],
      },
    }),
    prisma.pageComment.count({ where: { userId: user.id } }),
    prisma.pageShare.count({ where: { householdId } }),
    prisma.pageTag.count({
      where: {
        page: {
          archived: false,
          OR: [
            { ownerId: user.id },
            { ownerId: householdId },
            { createdBy: user.id },
          ],
        },
      },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* User Info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="size-5" /> Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
            <Badge variant="outline" className="ml-auto">{user.role}</Badge>
          </div>
          {household && (
            <div className="pt-2 border-t">
              <div className="text-sm text-muted-foreground">Current Household</div>
              <div className="font-medium">{household.name}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wiki Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="size-4" /> Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pageCount}</div>
            <p className="text-xs text-muted-foreground">Pages you own or created</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="size-4" /> Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commentCount}</div>
            <p className="text-xs text-muted-foreground">Comments you&apos;ve written</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Share2 className="size-4" /> Shared with You</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shareCount}</div>
            <p className="text-xs text-muted-foreground">Pages shared to your household</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Tag className="size-4" /> Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tagCount}</div>
            <p className="text-xs text-muted-foreground">Tags across your pages</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
