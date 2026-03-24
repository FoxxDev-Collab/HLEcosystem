import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PageEditor } from "./editor";
import type { JSONContent } from "@tiptap/react";

export default async function EditPagePage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const page = await prisma.wikiPage.findUnique({
    where: { id: pageId },
    select: { id: true, title: true, content: true, createdBy: true },
  });
  if (!page) notFound();
  if (user.role !== "ADMIN" && page.createdBy !== user.id) notFound();

  return <PageEditor pageId={page.id} initialTitle={page.title} initialContent={page.content as JSONContent} />;
}
