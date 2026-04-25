const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll",
  ".com", ".scr", ".vbs", ".vbe", ".wsf", ".wsh", ".cpl",
  ".inf", ".reg", ".pif", ".app", ".action", ".command",
]);

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || "500", 10) * 1024 * 1024;

// Magic byte signatures for common file types
const MAGIC_SIGNATURES: Array<{ bytes: number[]; offset?: number; mime: string }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" },               // PNG
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },                     // JPEG
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif" },               // GIF
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp" },              // WebP (RIFF)
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },         // PDF
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip" },         // ZIP/DOCX/XLSX
  { bytes: [0x1f, 0x8b], mime: "application/gzip" },                     // GZIP
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mime: "video/mp4" },      // MP4 (ftyp at offset 4)
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: "video/webm" },              // WebM/MKV
  { bytes: [0x49, 0x44, 0x33], mime: "audio/mpeg" },                     // MP3 (ID3)
  { bytes: [0xff, 0xfb], mime: "audio/mpeg" },                           // MP3 (sync)
  { bytes: [0xff, 0xf3], mime: "audio/mpeg" },                           // MP3 (sync)
  { bytes: [0x4f, 0x67, 0x67, 0x53], mime: "audio/ogg" },               // OGG
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "audio/wav" },               // WAV (RIFF)
  { bytes: [0x42, 0x4d], mime: "image/bmp" },                            // BMP
];

export function sanitizeFilename(name: string): string {
  // Strip path traversal
  let sanitized = name
    .replace(/\.\.[/\\]/g, "")
    .replace(/[/\\]/g, "")
    .replace(/\0/g, "")
    // Remove control characters
    .replace(/[\x00-\x1f\x7f]/g, "")
    // Remove problematic characters
    .replace(/[<>:"|?*]/g, "")
    .trim();

  // Collapse whitespace
  sanitized = sanitized.replace(/\s+/g, " ");

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.lastIndexOf(".");
    if (ext > 0) {
      const extension = sanitized.substring(ext);
      sanitized = sanitized.substring(0, 255 - extension.length) + extension;
    } else {
      sanitized = sanitized.substring(0, 255);
    }
  }

  // Fallback if empty
  if (!sanitized || sanitized === ".") {
    sanitized = "unnamed_file";
  }

  return sanitized;
}

export function isBlockedExtension(filename: string): boolean {
  const ext = filename.lastIndexOf(".");
  if (ext < 0) return false;
  return BLOCKED_EXTENSIONS.has(filename.substring(ext).toLowerCase());
}

export function detectMimeType(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.mime;
  }
  return null;
}

export function validateMimeType(
  buffer: Buffer,
  declaredMime: string
): { valid: boolean; detectedMime: string } {
  const detected = detectMimeType(buffer);

  // If we can detect the type, use it (more trustworthy than client declaration)
  if (detected) {
    return { valid: true, detectedMime: detected };
  }

  // For text-like types where magic bytes don't apply, trust the declaration
  // but verify it's in the allowed set
  if (
    declaredMime.startsWith("text/") ||
    declaredMime === "application/json" ||
    declaredMime === "application/xml" ||
    declaredMime === "application/javascript"
  ) {
    return { valid: true, detectedMime: declaredMime };
  }

  // Unknown binary type — allow but use generic MIME
  return { valid: true, detectedMime: declaredMime || "application/octet-stream" };
}

export function isWithinSizeLimit(size: number, maxBytes?: number): boolean {
  return size <= (maxBytes ?? MAX_FILE_SIZE);
}

// uploadId is generated server-side as `${Date.now()}_${random}`.
// Validate before using it in a file path to prevent directory traversal.
export function isValidUploadId(uploadId: string): boolean {
  return /^\d+_[a-z0-9]+$/i.test(uploadId);
}

// MIME types that can execute scripts when served inline from the same origin.
// These are forced to attachment + application/octet-stream by the serve routes.
export const UNSAFE_INLINE_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "image/svg+xml",
]);

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName: string;
  detectedMime: string;
}

export function validateUpload(file: {
  name: string;
  size: number;
  buffer: Buffer;
  type: string;
}): UploadValidationResult {
  const sanitizedName = sanitizeFilename(file.name);

  if (isBlockedExtension(sanitizedName)) {
    return {
      valid: false,
      error: `File type not allowed: ${sanitizedName.substring(sanitizedName.lastIndexOf("."))}`,
      sanitizedName,
      detectedMime: file.type,
    };
  }

  if (!isWithinSizeLimit(file.size)) {
    const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxMB}MB`,
      sanitizedName,
      detectedMime: file.type,
    };
  }

  const { detectedMime } = validateMimeType(file.buffer, file.type);

  return { valid: true, sanitizedName, detectedMime };
}
