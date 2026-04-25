import { createHash } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, unlink, stat, access, rename, readdir, rm } from "fs/promises";
import { writeFile } from "fs/promises";
import { dirname, extname, join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const CHUNK_ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

export function getFilesDir(householdId: string): string {
  return join(UPLOAD_DIR, householdId, "files");
}

export function getThumbnailDir(householdId: string): string {
  return join(UPLOAD_DIR, householdId, "thumbnails");
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

  // Dedup: skip write if same hash file already exists on disk
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

export async function readFileBuffer(storagePath: string): Promise<Buffer> {
  const { readFile } = await import("fs/promises");
  return readFile(storagePath);
}

export async function fileExistsOnDisk(storagePath: string): Promise<boolean> {
  try {
    await access(storagePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFileSize(storagePath: string): Promise<number> {
  const s = await stat(storagePath);
  return s.size;
}

// ============================================================================
// STREAMING UPLOAD (single request, no memory buffering)
// ============================================================================

/**
 * Stream a Web ReadableStream directly to a temp file on disk,
 * computing the SHA-256 hash incrementally. Returns the temp path,
 * hash, and total bytes written.
 */
export async function saveFileStreaming(
  householdId: string,
  stream: ReadableStream<Uint8Array>,
  originalName: string
): Promise<{ storagePath: string; contentHash: string; size: number }> {
  const ext = extname(originalName).toLowerCase() || ".bin";
  const tempDir = join(UPLOAD_DIR, householdId, "tmp");
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const hash = createHash("sha256");
  let totalSize = 0;

  const nodeStream = Readable.fromWeb(stream as import("stream/web").ReadableStream);
  const writeStream = createWriteStream(tempPath);

  // Pipe through hash computation
  nodeStream.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    totalSize += chunk.length;
  });

  await pipeline(nodeStream, writeStream);

  const contentHash = hash.digest("hex");
  const storagePath = getStoragePath(householdId, contentHash, ext);

  // Content-addressed dedup: move temp to final location
  if (await fileExistsOnDisk(storagePath)) {
    // Same content already exists — discard temp
    await unlink(tempPath);
  } else {
    await mkdir(dirname(storagePath), { recursive: true });
    await rename(tempPath, storagePath);
  }

  return { storagePath, contentHash, size: totalSize };
}

// ============================================================================
// CHUNKED UPLOAD (multi-request, any file size)
// ============================================================================

function getChunksDir(householdId: string, uploadId: string): string {
  return join(UPLOAD_DIR, householdId, "chunks", uploadId);
}

/**
 * Initialize a chunked upload session. Returns the uploadId (directory name).
 * Lazily cleans up any stale chunk directories older than CHUNK_ORPHAN_MAX_AGE_MS.
 */
export async function initChunkedUpload(
  householdId: string
): Promise<string> {
  const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const chunksDir = getChunksDir(householdId, uploadId);
  await mkdir(chunksDir, { recursive: true });

  // Fire-and-forget orphan sweep — doesn't block the response
  sweepOrphanChunks(householdId).catch(() => {});

  return uploadId;
}

/**
 * Remove chunk directories older than CHUNK_ORPHAN_MAX_AGE_MS.
 * These are left behind when a chunked upload was initiated but never completed or aborted.
 */
async function sweepOrphanChunks(householdId: string): Promise<void> {
  const chunksRoot = join(UPLOAD_DIR, householdId, "chunks");
  let entries: string[];
  try {
    entries = await readdir(chunksRoot);
  } catch {
    return; // chunks dir doesn't exist yet — nothing to sweep
  }

  const cutoff = Date.now() - CHUNK_ORPHAN_MAX_AGE_MS;
  for (const entry of entries) {
    const dirPath = join(chunksRoot, entry);
    try {
      const s = await stat(dirPath);
      if (s.isDirectory() && s.mtimeMs < cutoff) {
        await rm(dirPath, { recursive: true, force: true });
      }
    } catch {
      // ignore individual errors — best effort
    }
  }
}

/**
 * Save a single chunk to the chunked upload directory.
 * Chunk index is zero-based.
 */
export async function saveChunk(
  householdId: string,
  uploadId: string,
  chunkIndex: number,
  stream: ReadableStream<Uint8Array>
): Promise<number> {
  const chunksDir = getChunksDir(householdId, uploadId);
  const chunkPath = join(chunksDir, `chunk_${String(chunkIndex).padStart(6, "0")}`);

  const nodeStream = Readable.fromWeb(stream as import("stream/web").ReadableStream);
  const writeStream = createWriteStream(chunkPath);

  let size = 0;
  nodeStream.on("data", (chunk: Buffer) => {
    size += chunk.length;
  });

  await pipeline(nodeStream, writeStream);
  return size;
}

/**
 * Assemble all chunks into the final content-addressed file.
 * Computes SHA-256 incrementally during assembly. Cleans up chunks after.
 */
export async function assembleChunks(
  householdId: string,
  uploadId: string,
  originalName: string
): Promise<{ storagePath: string; contentHash: string; size: number }> {
  const chunksDir = getChunksDir(householdId, uploadId);
  const ext = extname(originalName).toLowerCase() || ".bin";

  // List and sort chunk files
  const entries = await readdir(chunksDir);
  const chunkFiles = entries
    .filter((f) => f.startsWith("chunk_"))
    .sort();

  if (chunkFiles.length === 0) {
    throw new Error("No chunks found for upload");
  }

  // Assemble into temp file while computing hash
  const tempDir = join(UPLOAD_DIR, householdId, "tmp");
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `assemble_${uploadId}`);

  const hash = createHash("sha256");
  let totalSize = 0;
  const writeStream = createWriteStream(tempPath);

  for (const chunkFile of chunkFiles) {
    const chunkPath = join(chunksDir, chunkFile);
    const readStream = createReadStream(chunkPath);

    await new Promise<void>((resolve, reject) => {
      readStream.on("data", (chunk: string | Buffer) => {
        if (typeof chunk === "string") chunk = Buffer.from(chunk);
        hash.update(chunk);
        totalSize += chunk.length;
      });
      readStream.on("error", reject);
      readStream.pipe(writeStream, { end: false });
      readStream.on("end", resolve);
    });
  }

  writeStream.end();
  await new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  const contentHash = hash.digest("hex");
  const storagePath = getStoragePath(householdId, contentHash, ext);

  // Dedup move
  if (await fileExistsOnDisk(storagePath)) {
    await unlink(tempPath);
  } else {
    await mkdir(dirname(storagePath), { recursive: true });
    await rename(tempPath, storagePath);
  }

  // Clean up chunks directory
  await rm(chunksDir, { recursive: true, force: true });

  return { storagePath, contentHash, size: totalSize };
}

/**
 * Abort a chunked upload — clean up chunks.
 */
export async function abortChunkedUpload(
  householdId: string,
  uploadId: string
): Promise<void> {
  const chunksDir = getChunksDir(householdId, uploadId);
  await rm(chunksDir, { recursive: true, force: true });
}

// ============================================================================
// THUMBNAILS
// ============================================================================

/**
 * Generate a 200x200 WebP thumbnail for an image file.
 * Returns the thumbnail path, or null if not an image or generation fails.
 */
export async function generateThumbnail(
  householdId: string,
  fileId: string,
  storagePath: string,
  mimeType: string
): Promise<string | null> {
  if (!mimeType.startsWith("image/")) return null;

  try {
    const sharp = (await import("sharp")).default;
    // Pass the path string — sharp/libvips reads it as a stream internally.
    const thumbnail = await sharp(storagePath)
      .resize(400, 400, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return saveThumbnail(householdId, fileId, thumbnail);
  } catch {
    // Thumbnail generation is best-effort — don't block upload
    return null;
  }
}

export async function saveThumbnail(
  householdId: string,
  fileId: string,
  buffer: Buffer
): Promise<string> {
  const thumbnailDir = getThumbnailDir(householdId);
  await mkdir(thumbnailDir, { recursive: true });
  const thumbnailPath = join(thumbnailDir, `${fileId}_thumb.webp`);
  await writeFile(thumbnailPath, buffer);
  return thumbnailPath;
}
