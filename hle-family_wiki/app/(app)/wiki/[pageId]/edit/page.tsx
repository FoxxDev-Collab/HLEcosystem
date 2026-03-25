import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getUsersByIds } from "@/lib/users";
import { formatDateRelative, formatDate } from "@/lib/format";
import { PageEditor } from "./editor";
import type { JSONContent } from "@tiptap/react";

export default async function EditPagePage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const page = await prisma.wikiPage.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      title: true,
      content: true,
      createdBy: true,
      updatedBy: true,
      updatedAt: true,
      createdAt: true,
      visibility: true,
      wordCount: true,
      tags: { select: { tag: true } },
      _count: { select: { versions: true } },
    },
  });
  if (!page) notFound();
  if (user.role !== "ADMIN" && page.createdBy !== user.id) notFound();

  const userMap = await getUsersByIds([page.updatedBy, page.createdBy]);
  const updatedByName = userMap.get(page.updatedBy)?.name ?? "Unknown";
  const createdByName = userMap.get(page.createdBy)?.name ?? "Unknown";

  return (
    <PageEditor
      pageId={page.id}
      initialTitle={page.title}
      initialContent={page.content as JSONContent}
      authorName={updatedByName}
      createdByName={createdByName}
      updatedAt={formatDateRelative(page.updatedAt)}
      createdAt={formatDate(page.createdAt)}
      visibility={page.visibility}
      wordCount={page.wordCount}
      versionCount={page._count.versions}
      tags={page.tags.map((t) => t.tag)}
    />
  );
}
