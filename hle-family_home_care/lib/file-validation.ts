const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll",
  ".com", ".scr", ".vbs", ".vbe", ".wsf", ".wsh", ".cpl",
  ".inf", ".reg", ".pif", ".app", ".action", ".command",
]);

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || "50", 10) * 1024 * 1024;

const MAGIC_SIGNATURES: Array<{ bytes: number[]; offset?: number; mime: string }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" },
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp" },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip" },
];

export function sanitizeFilename(name: string): string {
  let sanitized = name
    .replace(/\.\.[/\\]/g, "")
    .replace(/[/\\]/g, "")
    .replace(/\0/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[<>:"|?*]/g, "")
    .trim();

  sanitized = sanitized.replace(/\s+/g, " ");

  if (sanitized.length > 255) {
    const ext = sanitized.lastIndexOf(".");
    if (ext > 0) {
      const extension = sanitized.substring(ext);
      sanitized = sanitized.substring(0, 255 - extension.length) + extension;
    } else {
      sanitized = sanitized.substring(0, 255);
    }
  }

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

function detectMimeType(buffer: Buffer): string | null {
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

export function validateUpload(file: {
  name: string;
  size: number;
  buffer: Buffer;
  type: string;
}): { valid: boolean; error?: string; sanitizedName: string; detectedMime: string } {
  const sanitizedName = sanitizeFilename(file.name);

  if (isBlockedExtension(sanitizedName)) {
    return {
      valid: false,
      error: `File type not allowed: ${sanitizedName.substring(sanitizedName.lastIndexOf("."))}`,
      sanitizedName,
      detectedMime: file.type,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxMB}MB`,
      sanitizedName,
      detectedMime: file.type,
    };
  }

  const detected = detectMimeType(file.buffer);
  const detectedMime = detected || file.type || "application/octet-stream";

  return { valid: true, sanitizedName, detectedMime };
}
