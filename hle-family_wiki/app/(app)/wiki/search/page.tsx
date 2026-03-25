import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Lock, Users, Globe, Share2, Tag, ChevronRight } from "lucide-react";

const ICONS: Record<string, typeof Lock> = { PRIVATE: Lock, HOUSEHOLD: Users, SHARED: Share2, PUBLIC: Globe };
const COLORS: Record<string, string> = {
  PRIVATE: "bg-muted text-muted-foreground",
  HOUSEHOLD: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  SHARED: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  PUBLIC: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

type Result = { id: string; title: string; visibility: string; updatedAt: Date; updatedBy: string; contentText: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const { q, tag } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = (await getCurrentHouseholdId())!;

  let results: Result[] = [];

  if (tag && tag.trim().length > 0) {
    results = await prisma.$queryRaw<Result[]>`
      SELECT p."id", p."title", p."visibility", p."updatedAt", p."updatedBy", LEFT(p."contentText", 200) as "contentText"
      FROM family_wiki."WikiPage" p
      JOIN family_wiki."PageTag" pt ON pt."pageId" = p."id" AND pt."tag" = ${tag.trim().toLowerCase()}
      LEFT JOIN family_wiki."PageShare" ps ON ps."pageId" = p."id" AND ps."householdId" = ${householdId}
      WHERE p."archived" = false
        AND (p."visibility" = 'PUBLIC' OR (p."visibility" = 'PRIVATE' AND p."ownerId" = ${user.id})
          OR (p."visibility" = 'HOUSEHOLD' AND p."ownerId" = ${householdId}) OR ps."id" IS NOT NULL OR p."createdBy" = ${user.id})
      ORDER BY p."updatedAt" DESC
      LIMIT 50
    `;
  } else if (q && q.trim().length > 0) {
    const query = q.trim();
    results = await prisma.$queryRaw<Result[]>`
      SELECT p."id", p."title", p."visibility", p."updatedAt", p."updatedBy", LEFT(p."contentText", 200) as "contentText"
      FROM family_wiki."WikiPage" p
      LEFT JOIN family_wiki."PageShare" ps ON ps."pageId" = p."id" AND ps."householdId" = ${householdId}
      WHERE p."archived" = false
        AND (p."visibility" = 'PUBLIC' OR (p."visibility" = 'PRIVATE' AND p."ownerId" = ${user.id})
          OR (p."visibility" = 'HOUSEHOLD' AND p."ownerId" = ${householdId}) OR ps."id" IS NOT NULL OR p."createdBy" = ${user.id})
        AND (to_tsvector('english', p."title" || ' ' || p."contentText") @@ plainto_tsquery('english', ${query}) OR p."title" ILIKE ${`%${query}%`})
      ORDER BY ts_rank(to_tsvector('english', p."title" || ' ' || p."contentText"), plainto_tsquery('english', ${query})) DESC, p."updatedAt" DESC
      LIMIT 50
    `;
  }

  const userMap = await getUsersByIds([...new Set(results.map((r) => r.updatedBy))] as string[]);

  const popularTags = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT pt."tag", COUNT(*) as count
    FROM family_wiki."PageTag" pt
    JOIN family_wiki."WikiPage" p ON p."id" = pt."pageId"
    LEFT JOIN family_wiki."PageShare" ps ON ps."pageId" = p."id" AND ps."householdId" = ${householdId}
    WHERE p."archived" = false
      AND (p."visibility" = 'PUBLIC' OR (p."visibility" = 'PRIVATE' AND p."ownerId" = ${user.id})
        OR (p."visibility" = 'HOUSEHOLD' AND p."ownerId" = ${householdId}) OR ps."id" IS NOT NULL OR p."createdBy" = ${user.id})
    GROUP BY pt."tag"
    ORDER BY count DESC
    LIMIT 20
  `;

  return (
    <div className="max-w-[800px] space-y-6">
      <h1 className="wiki-title text-3xl text-foreground">Search</h1>

      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q || ""} placeholder="Search pages..." className="pl-9 h-10" autoFocus />
        </div>
        <Button type="submit" className="h-10">Search</Button>
      </form>

      {popularTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="size-3.5 text-muted-foreground" />
          {popularTags.map((t) => (
            <Link key={t.tag} href={`/wiki/search?tag=${encodeURIComponent(t.tag)}`}>
              <Badge
                variant={tag === t.tag ? "default" : "secondary"}
                className="cursor-pointer text-[11px]"
              >
                {t.tag} ({Number(t.count)})
              </Badge>
            </Link>
          ))}
          {tag && (
            <Link href="/wiki/search">
              <Badge variant="outline" className="cursor-pointer text-[11px]">Clear</Badge>
            </Link>
          )}
        </div>
      )}

      {q && <p className="text-sm text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;</p>}
      {tag && <p className="text-sm text-muted-foreground">{results.length} page{results.length !== 1 ? "s" : ""} tagged &ldquo;{tag}&rdquo;</p>}

      <div className="space-y-2">
        {results.map((page) => {
          const Icon = ICONS[page.visibility] || Globe;
          const color = COLORS[page.visibility] || COLORS.PUBLIC;
          return (
            <Link key={page.id} href={`/wiki/${page.id}`}>
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
                <FileText className="size-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{page.title}</p>
                  {page.contentText && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{page.contentText}</p>
                  )}
                </div>
                <Badge className={`${color} text-[10px] font-medium border-0 shrink-0`}><Icon className="size-2.5 mr-1" />{page.visibility}</Badge>
                <div className="text-[11px] text-muted-foreground text-right shrink-0">
                  <div>{userMap.get(page.updatedBy)?.name ?? "Unknown"}</div>
                  <div>{formatDateRelative(page.updatedAt)}</div>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>
      {(q || tag) && results.length === 0 && (
        <div className="text-center py-12">
          <Search className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No pages match your search.</p>
        </div>
      )}
    </div>
  );
}
