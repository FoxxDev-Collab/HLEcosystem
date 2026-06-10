// Content-addressed file storage on local disk, ported from
// hle-family_home_care/lib/file-storage.ts. Files live at
// <UPLOAD_DIR>/<householdId>/documents/<sha256[0:2]>/<sha256><ext> so
// identical content within a household is stored once. Deletion refcounting
// happens at the query layer by "storagePath" — NOT by global contentHash,
// which was the legacy dedupe bug (two households, or two extensions, can
// share a hash while owning different files on disk).

import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { access, mkdir, unlink, writeFile } from "node:fs/promises"
import { dirname, extname, join } from "node:path"
import { Readable } from "node:stream"

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads"

export function getFilesDir(householdId: string): string {
  return join(UPLOAD_DIR, householdId, "documents")
}

export function computeContentHash(buffer: Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex")
}

export function getStoragePath(
  householdId: string,
  hash: string,
  ext: string
): string {
  const prefix = hash.substring(0, 2)
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`
  return join(getFilesDir(householdId), prefix, `${hash}${safeExt}`)
}

export async function saveFile(
  householdId: string,
  buffer: Uint8Array,
  originalName: string
): Promise<{ storagePath: string; contentHash: string; size: number }> {
  const contentHash = computeContentHash(buffer)
  const ext = extname(originalName).toLowerCase() || ".bin"
  const storagePath = getStoragePath(householdId, contentHash, ext)

  if (!(await fileExistsOnDisk(storagePath))) {
    await mkdir(dirname(storagePath), { recursive: true })
    await writeFile(storagePath, buffer)
  }

  return { storagePath, contentHash, size: buffer.length }
}

export async function deleteFileFromDisk(storagePath: string): Promise<void> {
  try {
    await unlink(storagePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }
}

export function readFileStream(storagePath: string): ReadableStream {
  const nodeStream = createReadStream(storagePath)
  // node:stream's web ReadableStream type and the DOM lib's are structurally
  // incompatible in TS even though they are the same thing at runtime.
  return Readable.toWeb(nodeStream) as unknown as ReadableStream
}

export async function fileExistsOnDisk(storagePath: string): Promise<boolean> {
  try {
    await access(storagePath)
    return true
  } catch {
    return false
  }
}
