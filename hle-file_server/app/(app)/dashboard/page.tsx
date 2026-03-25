import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  formatFileSize,
  formatDateRelative,
  formatStoragePercent,
} from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  Files,
  HardDrive,
  Image,
  Album,
  Star,
  Upload,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";

async function getDashboardData(householdId: string, userId: string) {
  const [
    fileCount,
    folderCount,
    photoCount,
    videoCount,
    albumCount,
    favoriteCount,
    recentFiles,
    recentPhotos,
    storageQuota,
  ] = await Promise.all([
    prisma.file.count({
      where: { householdId, status: "ACTIVE", deletedAt: null },
    }),
    prisma.folder.count({
      where: { householdId, deletedAt: null },
    }),
    prisma.file.count({
      where: {
        householdId,
        status: "ACTIVE",
        deletedAt: null,
        mimeType: { startsWith: "image/" },
      },
    }),
    prisma.file.count({
      where: {
        householdId,
        status: "ACTIVE",
        deletedAt: null,
        mimeType: { startsWith: "video/" },
      },
    }),
    prisma.album.count({ where: { householdId } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.file.findMany({
      where: { householdId, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    }),
    prisma.file.findMany({
      where: {
        householdId,
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          { mimeType: { startsWith: "image/" } },
          { mimeType: { startsWith: "video/" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        mimeType: true,
        createdAt: true,
      },
    }),
    prisma.storageQuota.findUnique({ where: { householdId } }),
  ]);

  const totalSizeResult = await prisma.file.aggregate({
    where: { householdId, status: "ACTIVE", deletedAt: null },
    _sum: { size: true },
  });
  const totalSize = totalSizeResult._sum.size ?? BigInt(0);

  // Memories — photos from this day in previous years
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  let memories: { id: string; name: string; mimeType: string; createdAt: Date }[] = [];
  try {
    memories = await prisma.$queryRaw<typeof memories>`
      SELECT "id", "name", "mimeType", "createdAt"
      FROM file_server."File"
      WHERE "householdId" = ${householdId}
        AND "status" = 'ACTIVE'
        AND "deletedAt" IS NULL
        AND ("mimeType" LIKE 'image/%' OR "mimeType" LIKE 'video/%')
        AND EXTRACT(MONTH FROM "createdAt") = ${currentMonth}
        AND EXTRACT(DAY FROM "createdAt") = ${currentDay}
        AND EXTRACT(YEAR FROM "createdAt") < ${now.getFullYear()}
      ORDER BY "createdAt" DESC
      LIMIT 12
    `;
  } catch {
    // Memories query may fail if schema not migrated yet
  }

  return {
    fileCount,
    folderCount,
    photoCount,
    videoCount,
    albumCount,
    favoriteCount,
    recentFiles,
    recentPhotos,
    totalSize,
    storageQuota,
    memories,
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const data = await getDashboardData(householdId, user.id);
  const maxStorage = data.storageQuota?.maxStorageBytes ?? BigInt(5368709120);
  const usagePercent = formatStoragePercent(data.totalSize, maxStorage);

  // Storage breakdown approximation
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (usagePercent / 100) * circumference;

  return (
    <div className="space-y-8 max-w-[1200px]">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Left column — main content */}
        <div className="space-y-6 min-w-0">
          {/* Memories section */}
          {data.memories.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">On this day</h2>
                <span className="text-xs text-muted-foreground">
                  {data.memories.length} memor{data.memories.length !== 1 ? "ies" : "y"}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 fs-scroll">
                {data.memories.map((photo) => {
                  const yearsAgo =
                    new Date().getFullYear() - photo.createdAt.getFullYear();
                  return (
                    <Link
                      key={photo.id}
                      href={`/browse/${photo.id}`}
                      className="shrink-0"
                    >
                      <div className="memory-card w-44 sm:w-52">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/files/thumbnail/${photo.id}`}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
                          <p className="text-white/90 text-xs font-semibold">
                            {yearsAgo} year{yearsAgo !== 1 ? "s" : ""} ago
                          </p>
                          <p className="text-white/60 text-[10px] truncate mt-0.5">
                            {photo.name}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recent photos */}
          {data.recentPhotos.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Image className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Recent Photos</h2>
                </div>
                <Link
                  href="/photos"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                  <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 gap-1.5 rounded-xl overflow-hidden">
                {data.recentPhotos.slice(0, 8).map((photo, i) => (
                  <Link key={photo.id} href={`/browse/${photo.id}`}>
                    <div className="aspect-square overflow-hidden rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/thumbnail/${photo.id}`}
                        alt={photo.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recent files */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Recent Files</h2>
              </div>
              <Link
                href="/browse"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Browse all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {data.recentFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No files yet. Upload your first file to get started.
                  </p>
                ) : (
                  <div className="divide-y">
                    {data.recentFiles.map((file) => (
                      <Link
                        key={file.id}
                        href={`/browse/${file.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-4">
                          {formatDateRelative(file.createdAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right column — sidebar */}
        <div className="space-y-6">
          {/* Storage card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HardDrive className="size-4" />
                Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center">
                <svg className="storage-ring" width="88" height="88" viewBox="0 0 88 88">
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-muted/50"
                  />
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className="text-primary"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                  <text
                    x="44"
                    y="44"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-foreground text-sm font-bold"
                    style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
                  >
                    {usagePercent}%
                  </text>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {formatFileSize(data.totalSize)}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {formatFileSize(maxStorage)} used
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Link
                href="/browse"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Files className="size-4 text-muted-foreground" />
                  <span>Files</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {data.fileCount}
                </span>
              </Link>
              <Link
                href="/photos"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Image className="size-4 text-muted-foreground" />
                  <span>Photos</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {data.photoCount}
                </span>
              </Link>
              {data.videoCount > 0 && (
                <Link
                  href="/photos"
                  className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                    <span>Videos</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {data.videoCount}
                  </span>
                </Link>
              )}
              <Link
                href="/albums"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Album className="size-4 text-muted-foreground" />
                  <span>Albums</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {data.albumCount}
                </span>
              </Link>
              <Link
                href="/favorites"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Star className="size-4 text-muted-foreground" />
                  <span>Favorites</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {data.favoriteCount}
                </span>
              </Link>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/browse"
                className="flex items-center gap-2.5 text-sm py-1.5 hover:text-primary transition-colors"
              >
                <Upload className="size-4" />
                Upload files
              </Link>
              <Link
                href="/albums"
                className="flex items-center gap-2.5 text-sm py-1.5 hover:text-primary transition-colors"
              >
                <Album className="size-4" />
                Create album
              </Link>
              <Link
                href="/photos"
                className="flex items-center gap-2.5 text-sm py-1.5 hover:text-primary transition-colors"
              >
                <Image className="size-4" />
                Browse photos
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
