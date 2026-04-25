"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { suggestTags, summarizeText, extractMetadata } from "@/lib/claude-api";

export async function moveToHouseholdAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const fileId = formData.get("fileId") as string;
  if (!fileId) return;

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, ownerId: user.id, deletedAt: null },
  });
  if (!file) return;

  await prisma.file.update({
    where: { id: fileId },
    data: { ownerId: null, folderId: null },
  });

  revalidatePath("/browse");
  revalidatePath("/my-files");
  revalidatePath("/dashboard");
  redirect("/browse");
}

// ============================================================================
// AI ACTIONS
// ============================================================================

export type TagSuggestion = { name: string; tagId: string | null };

export type SuggestTagsResponse =
  | { suggestions: TagSuggestion[]; reasoning: string }
  | { error: string };

export async function suggestTagsAction(fileId: string): Promise<SuggestTagsResponse> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, ownerId: user.id, deletedAt: null },
    include: { content: { select: { rawText: true } } },
  });
  if (!file) return { error: "File not found" };

  const existingTags = await prisma.tag.findMany({
    where: { householdId },
    select: { id: true, name: true },
  });

  const result = await suggestTags({
    text: file.content?.rawText ?? undefined,
    filename: file.name,
    existingTags: existingTags.map((t) => t.name),
  });

  if (!result.success || !result.data) {
    return { error: result.error ?? "Failed to get tag suggestions" };
  }

  const tagMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));
  const suggestions: TagSuggestion[] = result.data.tags.map((name) => ({
    name,
    tagId: tagMap.get(name.toLowerCase()) ?? null,
  }));

  return { suggestions, reasoning: result.data.reasoning };
}

export type GenerateSummaryResponse =
  | { summary: string; keyPoints: string[] }
  | { error: string };

export async function generateSummaryAction(fileId: string): Promise<GenerateSummaryResponse> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, ownerId: user.id, deletedAt: null },
    include: { content: { select: { rawText: true } } },
  });
  if (!file) return { error: "File not found" };
  if (!file.content?.rawText?.trim()) return { error: "No text content available to summarize" };

  const result = await summarizeText(file.content.rawText);
  if (!result.success || !result.data) {
    return { error: result.error ?? "Failed to generate summary" };
  }

  return { summary: result.data.summary, keyPoints: result.data.keyPoints };
}

export type ExtractMetadataResponse =
  | { correspondent: string | null; date: string | null; title: string; referenceNumbers: string[] }
  | { error: string };

export async function extractDocumentMetadataAction(fileId: string): Promise<ExtractMetadataResponse> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, ownerId: user.id, deletedAt: null },
    include: { content: { select: { rawText: true } } },
  });
  if (!file) return { error: "File not found" };
  if (!file.content?.rawText?.trim()) return { error: "No text content available to analyze" };

  const result = await extractMetadata(file.content.rawText);
  if (!result.success || !result.data) {
    return { error: result.error ?? "Failed to extract metadata" };
  }

  return {
    correspondent: result.data.correspondent,
    date: result.data.date,
    title: result.data.title,
    referenceNumbers: result.data.referenceNumbers,
  };
}

export type ApplyTagsResponse = { applied: number } | { error: string };

export async function applyTagSuggestionsAction(
  fileId: string,
  tagNames: string[]
): Promise<ApplyTagsResponse> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  if (!tagNames.length) return { applied: 0 };

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, ownerId: user.id, deletedAt: null },
  });
  if (!file) return { error: "File not found" };

  let applied = 0;
  for (const name of tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    const tag = await prisma.tag.upsert({
      where: { householdId_name: { householdId, name: trimmed } },
      update: {},
      create: { householdId, name: trimmed },
    });

    const existing = await prisma.fileTag.findUnique({
      where: { fileId_tagId: { fileId, tagId: tag.id } },
    });
    if (!existing) {
      await prisma.fileTag.create({ data: { fileId, tagId: tag.id } });
      applied++;
    }
  }

  revalidatePath(`/my-files/${fileId}`);
  revalidatePath("/tags");
  return { applied };
}

export type SaveDescriptionResponse = { success: true } | { error: string };

export async function saveDescriptionAction(
  fileId: string,
  description: string
): Promise<SaveDescriptionResponse> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, ownerId: user.id, deletedAt: null },
  });
  if (!file) return { error: "File not found" };

  await prisma.file.update({
    where: { id: fileId },
    data: { description: description.trim() || null },
  });

  revalidatePath(`/my-files/${fileId}`);
  return { success: true };
}

export type RenameFileResponse = { success: true } | { error: string };

export async function renameFileAction(
  fileId: string,
  name: string
): Promise<RenameFileResponse> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name cannot be empty" };

  const file = await prisma.file.findFirst({
    where: { id: fileId, householdId, ownerId: user.id, deletedAt: null },
  });
  if (!file) return { error: "File not found" };

  await prisma.file.update({
    where: { id: fileId },
    data: { name: trimmed },
  });

  revalidatePath(`/my-files/${fileId}`);
  revalidatePath("/my-files");
  return { success: true };
}
