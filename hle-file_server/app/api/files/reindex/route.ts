import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { extractAndStoreContent } from "@/lib/document-parser";

// Concurrently extract content from up to this many files at once
const REINDEX_CONCURRENCY = 3;

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  let idx = 0;
  const worker = async () => {
    while (idx < items.length) {
      const item = items[idx++];
      await fn(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "No household" }, { status: 403 });

  // Find all active, non-deleted files that have no content record yet
  const files = await prisma.file.findMany({
    where: {
      householdId,
      status: "ACTIVE",
      deletedAt: null,
      content: null,
    },
    select: { id: true, storagePath: true, mimeType: true },
  });

  if (files.length === 0) {
    return NextResponse.json({ queued: 0, message: "All documents already indexed" });
  }

  // Run extraction with bounded concurrency — awaited so the response reflects
  // actual completion rather than just kicking off background work.
  // 512 KB text cap in the parser keeps each extraction fast.
  await runWithConcurrency(
    files,
    (f) => extractAndStoreContent(f.id, f.storagePath, f.mimeType),
    REINDEX_CONCURRENCY
  );

  return NextResponse.json({ queued: files.length, message: `Indexed ${files.length} document${files.length !== 1 ? "s" : ""}` });
}
