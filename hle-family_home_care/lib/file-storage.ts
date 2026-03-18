import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, unlink, access } from "fs/promises";
import { writeFile } from "fs/promises";
import { dirname, extname, join } from "path";
import { Readable } from "stream";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

export function getFilesDir(householdId: string): string {
  return join(UPLOAD_DIR, householdId, "documents");
}

export function computeContentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function getStoragePath(
  householdId: string,
  hash: string,
  ext: string
): string {
  const prefix = hash.substring(0, 2);
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  return join(getFilesDir(householdId), prefix, `${hash}${safeExt}`);
}

export async function saveFile(
  householdId: string,
  buffer: Buffer,
  originalName: string
): Promise<{ storagePath: string; contentHash: string; size: number }> {
  const contentHash = computeContentHash(buffer);
  const ext = extname(originalName).toLowerCase() || ".bin";
  const storagePath = getStoragePath(householdId, contentHash, ext);

  if (!(await fileExistsOnDisk(storagePath))) {
    await mkdir(dirname(storagePath), { recursive: true });
    await writeFile(storagePath, buffer);
  }

  return { storagePath, contentHash, size: buffer.length };
}

export async function deleteFileFromDisk(storagePath: string): Promise<void> {
  try {
    await unlink(storagePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export function readFileStream(storagePath: string): ReadableStream {
  const nodeStream = createReadStream(storagePath);
  return Readable.toWeb(nodeStream) as ReadableStream;
}

export async function fileExistsOnDisk(storagePath: string): Promise<boolean> {
  try {
    await access(storagePath);
    return true;
  } catch {
    return false;
  }
}
