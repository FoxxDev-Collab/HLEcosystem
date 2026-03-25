import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { FileText, Share2, ChevronRight, Eye, Pencil } from "lucide-react";

export default async function SharedPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = (await getCurrentHouseholdId())!;

  const shares = await prisma.pageShare.findMany({
    where: { householdId },
    include: { page: { select: { id: true, title: true, updatedAt: true, updatedBy: true, archived: true, parentId: true, contentText: true } } },
  });

  const pages = shares.map((s) => ({ ...s.page, permission: s.permission })).filter((p) => !p.archived && !p.parentId);
  const userMap = await getUsersByIds([...new Set(pages.map((p) => p.updatedBy))] as string[]);

  return (
    <div className="space-y-6 max-w-[800px]">
      <div>
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-muted-foreground" />
          <h1 className="wiki-title text-3xl text-foreground">Shared with Me</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{pages.length} pages shared to your household</p>
      </div>

      {pages.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Share2 className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No pages have been shared with your household yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <Link key={page.id} href={`/wiki/${page.id}`}>
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
                <FileText className="size-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{page.title}</p>
                  {page.contentText && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{page.contentText.substring(0, 100)}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                  {page.permission === "EDIT" ? <Pencil className="size-2.5" /> : <Eye className="size-2.5" />}
                  {page.permission === "EDIT" ? "Can Edit" : "View Only"}
                </Badge>
                <div className="text-[11px] text-muted-foreground text-right shrink-0">
                  <div>{userMap.get(page.updatedBy)?.name ?? "Unknown"}</div>
                  <div>{formatDateRelative(page.updatedAt)}</div>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
