import { readFile } from "fs/promises";
import prisma from "@/lib/prisma";

// Maximum characters stored in rawText — prevents enormous tsvectors
const MAX_TEXT_BYTES = 512 * 1024; // 512 KB

export type ParseResult = {
  rawText: string;
  pageCount?: number;
  wordCount?: number;
};

// ---------------------------------------------------------------------------
// Per-format parsers
// ---------------------------------------------------------------------------

async function parsePdf(buf: Buffer): Promise<ParseResult | null> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as unknown as { default: (buf: Buffer) => Promise<{ text: string; numpages: number }> }).default ?? pdfParseModule;
    const data = await (pdfParse as (buf: Buffer) => Promise<{ text: string; numpages: number }>)(buf);
    const rawText = data.text.slice(0, MAX_TEXT_BYTES);
    const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
    return { rawText, pageCount: data.numpages, wordCount };
  } catch {
    return null;
  }
}

async function parseDocx(buf: Buffer): Promise<ParseResult | null> {
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const rawText = value.slice(0, MAX_TEXT_BYTES);
    const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
    return { rawText, wordCount };
  } catch {
    return null;
  }
}

async function parseXlsx(buf: Buffer): Promise<ParseResult | null> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      parts.push(XLSX.utils.sheet_to_csv(ws));
    }
    const rawText = parts.join("\n").slice(0, MAX_TEXT_BYTES);
    const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
    return { rawText, wordCount };
  } catch {
    return null;
  }
}

async function parseText(buf: Buffer): Promise<ParseResult | null> {
  try {
    const rawText = buf.toString("utf-8").slice(0, MAX_TEXT_BYTES);
    const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
    return { rawText, wordCount };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function isSupportedMime(mimeType: string): boolean {
  if (mimeType === "application/pdf") return true;
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  )
    return true;
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv"
  )
    return true;
  if (mimeType.startsWith("text/")) return true;
  if (mimeType === "application/json" || mimeType === "application/xml") return true;
  return false;
}

async function parseDocument(buf: Buffer, mimeType: string): Promise<ParseResult | null> {
  if (mimeType === "application/pdf") return parsePdf(buf);
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  )
    return parseDocx(buf);
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv"
  )
    return parseXlsx(buf);
  if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml")
    return parseText(buf);
  return null;
}

// ---------------------------------------------------------------------------
// Public entry point — called fire-and-forget after upload
// ---------------------------------------------------------------------------

export async function extractAndStoreContent(
  fileId: string,
  storagePath: string,
  mimeType: string
): Promise<void> {
  if (!isSupportedMime(mimeType)) return;

  let buf: Buffer;
  try {
    buf = await readFile(storagePath);
  } catch {
    return;
  }

  const result = await parseDocument(buf, mimeType);
  if (!result || !result.rawText.trim()) return;

  await prisma.fileContent.upsert({
    where: { fileId },
    create: {
      fileId,
      rawText: result.rawText,
      pageCount: result.pageCount ?? null,
      wordCount: result.wordCount ?? null,
    },
    update: {
      rawText: result.rawText,
      pageCount: result.pageCount ?? null,
      wordCount: result.wordCount ?? null,
      extractedAt: new Date(),
    },
  });
}
