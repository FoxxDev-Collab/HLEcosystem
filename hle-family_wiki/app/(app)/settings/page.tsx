import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId, getHouseholdById } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, MessageSquare, Share2, Tag, User, BookOpen } from "lucide-react";

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

  const stats = [
    { icon: FileText, label: "Pages", value: pageCount, desc: "Pages you own or created" },
    { icon: MessageSquare, label: "Comments", value: commentCount, desc: "Comments you've written" },
    { icon: Share2, label: "Shared", value: shareCount, desc: "Pages shared to household" },
    { icon: Tag, label: "Tags", value: tagCount, desc: "Tags across your pages" },
  ];

  return (
    <div className="max-w-[600px] space-y-8">
      <h1 className="wiki-title text-3xl text-foreground">Settings</h1>

      {/* Profile */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Account</h2>
        <div className="rounded-lg border border-border/60 bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-medium text-primary">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-lg">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
            <Badge variant="outline" className="text-xs">{user.role}</Badge>
          </div>
          {household && (
            <>
              <Separator className="my-4 opacity-60" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Current Household</div>
                  <div className="font-medium">{household.name}</div>
                </div>
                <BookOpen className="size-4 text-muted-foreground" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Activity</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border/60 bg-card p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <s.icon className="size-3.5" />
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <div className="text-2xl font-semibold">{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
