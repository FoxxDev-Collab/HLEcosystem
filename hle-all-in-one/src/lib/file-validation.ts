// Upload validation ported from hle-family_home_care/lib/file-validation.ts:
// filename sanitization, extension blocklist, size cap (env MAX_FILE_SIZE_MB,
// default 50) and magic-byte MIME detection. Never trust the client-reported
// Content-Type — the detected MIME wins when a signature matches.

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".msi",
  ".dll",
  ".com",
  ".scr",
  ".vbs",
  ".vbe",
  ".wsf",
  ".wsh",
  ".cpl",
  ".inf",
  ".reg",
  ".pif",
  ".app",
  ".action",
  ".command",
])

const MAX_FILE_SIZE =
  parseInt(process.env.MAX_FILE_SIZE_MB || "50", 10) * 1024 * 1024

const MAGIC_SIGNATURES: Array<{
  bytes: Array<number>
  offset?: number
  mime: string
}> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" },
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp" },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip" },
]

// Drops ASCII control characters (0x00–0x1f, 0x7f) without a control-char
// regex literal (no-control-regex).
function stripControlChars(value: string): string {
  let out = ""
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code <= 0x1f || code === 0x7f) continue
    out += ch
  }
  return out
}

export function sanitizeFilename(name: string): string {
  // Removing EVERY path separator makes traversal sequences unrepresentable —
  // there is deliberately no ../-specific replace (a partial multi-char strip
  // can reassemble into the very sequence it removed; CodeQL
  // js/incomplete-multi-character-sanitization).
  let sanitized = stripControlChars(
    name.replace(/[/\\]/g, "").replace(/[<>:"|?*]/g, "")
  ).trim()

  sanitized = sanitized.replace(/\s+/g, " ")

  if (sanitized.length > 255) {
    const ext = sanitized.lastIndexOf(".")
    if (ext > 0) {
      const extension = sanitized.substring(ext)
      sanitized = sanitized.substring(0, 255 - extension.length) + extension
    } else {
      sanitized = sanitized.substring(0, 255)
    }
  }

  // "." and ".." are directory references, not filenames — a bare ".." would
  // otherwise survive the character strips above and reach path joins.
  if (!sanitized || sanitized === "." || sanitized === "..") {
    sanitized = "unnamed_file"
  }

  return sanitized
}

export function isBlockedExtension(filename: string): boolean {
  const ext = filename.lastIndexOf(".")
  if (ext < 0) return false
  return BLOCKED_EXTENSIONS.has(filename.substring(ext).toLowerCase())
}

function detectMimeType(buffer: Uint8Array): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0
    if (buffer.length < offset + sig.bytes.length) continue
    let match = true
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false
        break
      }
    }
    if (match) return sig.mime
  }
  return null
}

export type UploadValidation =
  | { valid: true; sanitizedName: string; detectedMime: string }
  | { valid: false; error: string; sanitizedName: string; detectedMime: string }

export function validateUpload(file: {
  name: string
  size: number
  buffer: Uint8Array
  type: string
}): UploadValidation {
  const sanitizedName = sanitizeFilename(file.name)

  if (isBlockedExtension(sanitizedName)) {
    return {
      valid: false,
      error: `File type not allowed: ${sanitizedName.substring(sanitizedName.lastIndexOf("."))}`,
      sanitizedName,
      detectedMime: file.type,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024))
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxMB}MB`,
      sanitizedName,
      detectedMime: file.type,
    }
  }

  const detected = detectMimeType(file.buffer)
  const detectedMime = detected || file.type || "application/octet-stream"

  return { valid: true, sanitizedName, detectedMime }
}
