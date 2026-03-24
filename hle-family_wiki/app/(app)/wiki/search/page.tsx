import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Lock, Users, Globe, Share2, Tag } from "lucide-react";

const ICONS: Record<string, typeof Lock> = { PRIVATE: Lock, HOUSEHOLD: Users, SHARED: Share2, PUBLIC: Globe };

type Result = { id: string; title: string; visibility: string; updatedAt: Date; updatedBy: string; contentText: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const { q, tag } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const householdId = (await getCurrentHouseholdId())!;

  let results: Result[] = [];

  if (tag && tag.trim().length > 0) {
    // Tag-based search
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
    // Full-text search
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

  // Popular tags for quick filtering
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
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Search Wiki</h1>
      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q || ""} placeholder="Search pages..." className="pl-9" autoFocus />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Popular tags */}
      {popularTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="size-4 text-muted-foreground" />
          {popularTags.map((t) => (
            <Link key={t.tag} href={`/wiki/search?tag=${encodeURIComponent(t.tag)}`}>
              <Badge
                variant={tag === t.tag ? "default" : "secondary"}
                className="cursor-pointer text-xs"
              >
                {t.tag} ({Number(t.count)})
              </Badge>
            </Link>
          ))}
          {tag && (
            <Link href="/wiki/search">
              <Badge variant="outline" className="cursor-pointer text-xs">Clear filter</Badge>
            </Link>
          )}
        </div>
      )}

      {q && <p className="text-sm text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;</p>}
      {tag && <p className="text-sm text-muted-foreground">{results.length} page{results.length !== 1 ? "s" : ""} tagged &ldquo;{tag}&rdquo;</p>}
      <div className="space-y-3">
        {results.map((page) => {
          const Icon = ICONS[page.visibility] || Globe;
          return (
            <Link key={page.id} href={`/wiki/${page.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="pt-6 space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <p className="font-medium">{page.title}</p>
                    <Badge variant="outline" className="text-xs ml-auto"><Icon className="size-3 mr-1" />{page.visibility}</Badge>
                  </div>
                  {page.contentText && <p className="text-sm text-muted-foreground line-clamp-2 pl-6">{page.contentText}</p>}
                  <p className="text-xs text-muted-foreground pl-6">{userMap.get(page.updatedBy)?.name ?? "Unknown"} &middot; {formatDateRelative(page.updatedAt)}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      {(q || tag) && results.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No pages match your search.</p>}
    </div>
  );
}
