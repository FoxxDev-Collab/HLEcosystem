import {
  FileText, Image, Video, Music, FileArchive, File,
  FileCode, FileSpreadsheet, Presentation, BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "code"
  | "archive"
  | "spreadsheet"
  | "presentation"
  | "document"
  | "unknown";

const MIME_CATEGORY_MAP: Record<string, FileCategory> = {
  "application/pdf": "pdf",
  "application/zip": "archive",
  "application/x-zip-compressed": "archive",
  "application/x-tar": "archive",
  "application/gzip": "archive",
  "application/x-gzip": "archive",
  "application/x-7z-compressed": "archive",
  "application/x-rar-compressed": "archive",
  "application/json": "code",
  "application/xml": "code",
  "application/javascript": "code",
  "application/typescript": "code",
  "application/x-yaml": "code",
  "application/sql": "code",
  "application/x-sh": "code",
  "text/csv": "spreadsheet",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/vnd.ms-powerpoint": "presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "presentation",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/rtf": "document",
};

export function getFileCategory(mimeType: string): FileCategory {
  if (MIME_CATEGORY_MAP[mimeType]) return MIME_CATEGORY_MAP[mimeType];
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/")) {
    // Check if it's a known code file type
    if (
      mimeType === "text/html" ||
      mimeType === "text/css" ||
      mimeType === "text/javascript" ||
      mimeType === "text/x-python" ||
      mimeType === "text/x-go" ||
      mimeType === "text/x-rust" ||
      mimeType === "text/x-java" ||
      mimeType === "text/x-c" ||
      mimeType === "text/x-typescript" ||
      mimeType === "text/yaml" ||
      mimeType === "text/xml" ||
      mimeType === "text/markdown"
    ) {
      return "code";
    }
    return "text";
  }
  return "unknown";
}

const CATEGORY_ICONS: Record<FileCategory, LucideIcon> = {
  image: Image,
  video: Video,
  audio: Music,
  pdf: BookOpen,
  text: FileText,
  code: FileCode,
  archive: FileArchive,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  document: FileText,
  unknown: File,
};

export function getFileIcon(mimeType: string): LucideIcon {
  return CATEGORY_ICONS[getFileCategory(mimeType)];
}

const CATEGORY_COLORS: Record<FileCategory, string> = {
  image: "text-violet-500",
  video: "text-rose-500",
  audio: "text-amber-500",
  pdf: "text-red-500",
  text: "text-neutral-500",
  code: "text-emerald-500",
  archive: "text-orange-500",
  spreadsheet: "text-green-600",
  presentation: "text-orange-600",
  document: "text-blue-500",
  unknown: "text-neutral-400",
};

export function getFileCategoryColor(mimeType: string): string {
  return CATEGORY_COLORS[getFileCategory(mimeType)];
}

export function isPreviewable(mimeType: string): boolean {
  const category = getFileCategory(mimeType);
  return ["image", "video", "audio", "pdf", "text", "code"].includes(category);
}

const CODE_EXTENSIONS: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".fish": "fish",
  ".sql": "sql",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  ".json": "json",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".ini": "ini",
  ".conf": "ini",
  ".cfg": "ini",
  ".md": "markdown",
  ".mdx": "markdown",
  ".txt": "plaintext",
  ".log": "plaintext",
  ".env": "plaintext",
  ".dockerfile": "dockerfile",
  ".prisma": "prisma",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".r": "r",
  ".lua": "lua",
  ".pl": "perl",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".hs": "haskell",
  ".clj": "clojure",
  ".vim": "vim",
  ".csv": "csv",
};

export function getCodeLanguage(filename: string): string | null {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return CODE_EXTENSIONS[ext] ?? null;
}

export const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".7z": "application/x-7z-compressed",
  ".rar": "application/x-rar-compressed",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
  ".md": "text/markdown",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".rtf": "application/rtf",
};
