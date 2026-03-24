import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Share2 } from "lucide-react";

export default async function SharedPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = (await getCurrentHouseholdId())!;

  const shares = await prisma.pageShare.findMany({
    where: { householdId },
    include: { page: { select: { id: true, title: true, updatedAt: true, updatedBy: true, archived: true, parentId: true } } },
  });

  const pages = shares.map((s) => ({ ...s.page, permission: s.permission })).filter((p) => !p.archived && !p.parentId);
  const userMap = await getUsersByIds([...new Set(pages.map((p) => p.updatedBy))] as string[]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Share2 className="size-5 text-muted-foreground" /><h1 className="text-2xl font-bold">Shared with Me</h1></div>
        <Badge variant="outline">{pages.length} pages</Badge>
      </div>
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No pages have been shared with your household yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Link key={page.id} href={`/wiki/${page.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /><p className="font-medium truncate">{page.title}</p></div>
                  <Badge variant="outline" className="text-xs">{page.permission === "EDIT" ? "Can Edit" : "View Only"}</Badge>
                  <p className="text-xs text-muted-foreground">{userMap.get(page.updatedBy)?.name ?? "Unknown"} &middot; {formatDateRelative(page.updatedAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
