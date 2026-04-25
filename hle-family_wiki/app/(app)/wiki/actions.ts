"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import type { PageVisibility } from "@prisma/client";

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 100);
}

function canEdit(page: { createdBy: string; ownerId: string; visibility?: string }, userId: string, role: string, currentHouseholdId: string): boolean {
  const ownerMatch = page.visibility === "PRIVATE" ? page.ownerId === userId : page.ownerId === currentHouseholdId;
  return ownerMatch && (role === "ADMIN" || page.createdBy === userId);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Page templates ───────────────────────────────────────────────────────────
// Each template defines TipTap ProseMirror JSON content and a plain-text
// excerpt that populates contentText for search indexing.

type Template = { content: object; contentText: string };

const TEMPLATES: Record<string, Template> = {
  "meeting-notes": {
    contentText: "Attendees Agenda Notes Action Items",
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Attendees" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Agenda" }] },
        { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Notes" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
        { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [] }] }] },
      ],
    },
  },
  "how-to": {
    contentText: "Overview Prerequisites Steps Notes",
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Overview" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Prerequisites" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Steps" }] },
        { type: "orderedList", attrs: { start: 1 }, content: [
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Notes" }] },
        { type: "paragraph", content: [] },
      ],
    },
  },
  "emergency": {
    contentText: "Emergency Procedures Location Contacts Steps",
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Location & Access" }] },
        { type: "paragraph", content: [] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Emergency Contacts" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "911 — Police / Fire / Medical" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Procedure" }] },
        { type: "orderedList", attrs: { start: 1 }, content: [
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Important Locations" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Breaker panel: " }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Water shutoff: " }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Gas shutoff: " }] }] },
        ]},
      ],
    },
  },
  "contacts": {
    contentText: "Name Role Phone Email Notes",
    content: {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            { type: "tableRow", content: [
              { type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [{ type: "text", text: "Name" }] }] },
              { type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [{ type: "text", text: "Role" }] }] },
              { type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [{ type: "text", text: "Phone" }] }] },
              { type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [{ type: "text", text: "Email" }] }] },
              { type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [{ type: "text", text: "Notes" }] }] },
            ]},
            { type: "tableRow", content: [
              { type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [] }] },
              { type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [] }] },
              { type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [] }] },
              { type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [] }] },
              { type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [] }] },
            ]},
          ],
        },
      ],
    },
  },
  "recipe": {
    contentText: "Ingredients Instructions Notes",
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Ingredients" }] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Instructions" }] },
        { type: "orderedList", attrs: { start: 1 }, content: [
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [] }] },
        ]},
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Notes" }] },
        { type: "paragraph", content: [] },
      ],
    },
  },
};

export async function createPageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const visibility = (formData.get("visibility") as PageVisibility) || "HOUSEHOLD";
  const parentId = (formData.get("parentId") as string) || null;
  const templateKey = (formData.get("template") as string) || null;
  const ownerId = visibility === "PRIVATE" ? user.id : householdId;

  if (parentId) {
    const parent = await prisma.wikiPage.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (parent?.parentId) {
      const gp = await prisma.wikiPage.findUnique({ where: { id: parent.parentId }, select: { parentId: true } });
      if (gp?.parentId) return;
    }
  }

  let slug = slugify(title);
  const existing = await prisma.wikiPage.findFirst({ where: { ownerId, parentId, slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const tpl = templateKey ? TEMPLATES[templateKey] : null;

  const page = await prisma.wikiPage.create({
    data: {
      ownerId, visibility, parentId, title, slug,
      content: tpl?.content ?? {},
      contentText: tpl?.contentText ?? "",
      wordCount: tpl ? countWords(tpl.contentText) : 0,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  redirect(`/wiki/${page.id}/edit`);
}

export async function updatePageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;
  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  const contentJson = formData.get("content") as string;
  const contentText = (formData.get("contentText") as string) || "";
  if (!id || !title) return;

  let content = {};
  try { content = JSON.parse(contentJson); } catch { return; }

  const page = await prisma.wikiPage.findUnique({ where: { id } });
  if (!page || !canEdit(page, user.id, user.role, householdId)) return;

  const wordCount = countWords(contentText);

  // Create a version snapshot of the current state before updating
  const versionCount = await prisma.pageVersion.count({ where: { pageId: id } });
  await prisma.pageVersion.create({
    data: {
      pageId: id,
      version: versionCount + 1,
      title: page.title,
      content: page.content as object,
      editedBy: page.updatedBy,
      wordCount: page.wordCount,
    },
  });

  await prisma.wikiPage.update({
    where: { id },
    data: { title, content, contentText, wordCount, updatedBy: user.id },
  });

  revalidatePath(`/wiki/${id}`);
  revalidatePath("/wiki");
}

export async function deletePageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;
  const id = formData.get("id") as string;
  if (!id) return;
  const page = await prisma.wikiPage.findUnique({ where: { id } });
  if (!page || !canEdit(page, user.id, user.role, householdId)) return;
  await prisma.wikiPage.delete({ where: { id } });
  revalidatePath("/wiki");
  redirect("/wiki");
}

export async function togglePinAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;
  const id = formData.get("id") as string;
  if (!id) return;
  const page = await prisma.wikiPage.findUnique({ where: { id } });
  if (!page || !canEdit(page, user.id, user.role, householdId)) return;
  await prisma.wikiPage.update({ where: { id }, data: { pinned: !page.pinned } });
  revalidatePath(`/wiki/${id}`);
  revalidatePath("/wiki");
}

export async function toggleArchiveAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;
  const id = formData.get("id") as string;
  if (!id) return;
  const page = await prisma.wikiPage.findUnique({ where: { id } });
  if (!page || !canEdit(page, user.id, user.role, householdId)) return;
  await prisma.wikiPage.update({ where: { id }, data: { archived: !page.archived } });
  revalidatePath(`/wiki/${id}`);
  revalidatePath("/wiki");
}

export async function addCommentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const pageId = formData.get("pageId") as string;
  const message = (formData.get("message") as string)?.trim();
  const parentId = (formData.get("parentId") as string) || null;
  if (!pageId || !message) return;
  await prisma.pageComment.create({ data: { pageId, userId: user.id, parentId, message } });
  revalidatePath(`/wiki/${pageId}`);
}

export async function deleteCommentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = formData.get("id") as string;
  const pageId = formData.get("pageId") as string;
  if (!id) return;
  const comment = await prisma.pageComment.findUnique({ where: { id } });
  if (!comment) return;
  if (comment.userId !== user.id && user.role !== "ADMIN") return;
  await prisma.pageComment.delete({ where: { id } });
  revalidatePath(`/wiki/${pageId}`);
}

export async function sharePageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const pageId = formData.get("pageId") as string;
  const householdId = formData.get("householdId") as string;
  const permission = (formData.get("permission") as "VIEW" | "EDIT") || "VIEW";
  if (!pageId || !householdId) return;

  const currentHouseholdId = await getCurrentHouseholdId();
  if (!currentHouseholdId) return;
  const page = await prisma.wikiPage.findUnique({ where: { id: pageId } });
  if (!page || !canEdit(page, user.id, user.role, currentHouseholdId)) return;

  await prisma.pageShare.upsert({
    where: { pageId_householdId: { pageId, householdId } },
    create: { pageId, householdId, permission, grantedBy: user.id },
    update: { permission },
  });

  if (page.visibility !== "SHARED" && page.visibility !== "PUBLIC") {
    await prisma.wikiPage.update({ where: { id: pageId }, data: { visibility: "SHARED" } });
  }
  revalidatePath(`/wiki/${pageId}`);
}

export async function removeShareAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const pageId = formData.get("pageId") as string;
  const householdId = formData.get("householdId") as string;
  if (!pageId || !householdId) return;
  await prisma.pageShare.delete({ where: { pageId_householdId: { pageId, householdId } } }).catch(() => {});
  revalidatePath(`/wiki/${pageId}`);
}

export async function addTagAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;
  const pageId = formData.get("pageId") as string;
  const tag = (formData.get("tag") as string)?.trim().toLowerCase();
  if (!pageId || !tag) return;

  const page = await prisma.wikiPage.findUnique({ where: { id: pageId } });
  if (!page || !canEdit(page, user.id, user.role, householdId)) return;

  await prisma.pageTag.upsert({
    where: { pageId_tag: { pageId, tag } },
    create: { pageId, tag },
    update: {},
  });
  revalidatePath(`/wiki/${pageId}`);
}

export async function removeTagAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return;
  const pageId = formData.get("pageId") as string;
  const tag = formData.get("tag") as string;
  if (!pageId || !tag) return;

  const page = await prisma.wikiPage.findUnique({ where: { id: pageId } });
  if (!page || !canEdit(page, user.id, user.role, householdId)) return;

  await prisma.pageTag.delete({ where: { pageId_tag: { pageId, tag } } }).catch(() => {});
  revalidatePath(`/wiki/${pageId}`);
}
