import { useMemo } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Highlight from "@tiptap/extension-highlight"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import Superscript from "@tiptap/extension-superscript"
import Subscript from "@tiptap/extension-subscript"
import { Color, TextStyle } from "@tiptap/extension-text-style"
import Image from "@tiptap/extension-image"
import Typography from "@tiptap/extension-typography"
import type { JSONContent } from "@tiptap/react"

// Read-only renderer for stored TipTap JSON. Same node/mark coverage as the
// wiki editor (StarterKit in v3 already bundles Underline + Link), but kept
// independent of it so the view page never pulls in toolbar code.
//
// [security] Content renders through TipTap's React view (editable: false) —
// the JSON is interpreted by the ProseMirror schema, never injected as raw
// HTML anywhere on this path.
const viewerExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: true,
      HTMLAttributes: {
        class: "wiki-link",
        rel: "noopener noreferrer",
        target: "_blank",
      },
    },
  }),
  Highlight.configure({ multicolor: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table,
  TableRow,
  TableCell,
  TableHeader,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Superscript,
  Subscript,
  TextStyle,
  Color,
  Image.configure({ inline: false, allowBase64: true }),
  Typography,
]

// Typography for the rendered document — applied via arbitrary selectors so
// no shared stylesheet edits are needed.
const proseClass = [
  "text-sm leading-relaxed text-foreground",
  "[&_.tiptap]:outline-none",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_p]:my-2",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:my-0.5",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border",
  "[&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5",
  "[&_code]:font-mono [&_code]:text-[13px]",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-6 [&_hr]:border-border",
  "[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg",
  "[&_mark]:rounded-sm [&_mark]:px-0.5",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse",
  "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3",
  "[&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0",
  "[&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start",
  "[&_ul[data-type=taskList]_li]:gap-2",
  "[&_ul[data-type=taskList]_p]:my-0.5",
].join(" ")

export function WikiContent({ content }: { content: JSONContent }) {
  // Loader invalidations hand us a new (deep-equal) content object; key the
  // editor on the serialized doc so it only rebuilds on real changes.
  const contentKey = useMemo(() => JSON.stringify(content), [content])
  const editor = useEditor(
    {
      extensions: viewerExtensions,
      content,
      editable: false,
      // SSR-safe: defer ProseMirror mounting to the client (TipTap v3).
      immediatelyRender: false,
    },
    [contentKey]
  )
  if (!editor) return null
  return <EditorContent editor={editor} className={proseClass} />
}

// ─── Table of contents (top-level headings) ─────────────

type Heading = { level: number; text: string; id: string }

function extractHeadings(content: JSONContent): Array<Heading> {
  const headings: Array<Heading> = []
  if (!content.content) return headings
  for (const node of content.content) {
    if (node.type === "heading" && node.attrs?.level && node.content) {
      const text = node.content
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("")
      if (text.trim()) {
        headings.push({
          level: Number(node.attrs.level),
          text: text.trim(),
          id: text
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        })
      }
    }
  }
  return headings
}

export function TableOfContents({ content }: { content: JSONContent }) {
  const headings = extractHeadings(content)
  if (headings.length === 0) return null
  return (
    <nav className="space-y-1">
      {headings.map((h, i) => (
        <a
          key={`${h.id}-${i}`}
          href={`#${h.id}`}
          className="block truncate text-[13px] leading-snug text-muted-foreground transition-colors hover:text-foreground"
          style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  )
}
