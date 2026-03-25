"use client";

import type { JSONContent } from "@tiptap/react";

type Heading = { level: number; text: string; id: string };

function extractHeadings(content: JSONContent): Heading[] {
  const headings: Heading[] = [];
  if (!content?.content) return headings;

  for (const node of content.content) {
    if (node.type === "heading" && node.attrs?.level && node.content) {
      const text = node.content
        .filter((c: JSONContent) => c.type === "text")
        .map((c: JSONContent) => c.text || "")
        .join("");
      if (text.trim()) {
        headings.push({
          level: node.attrs.level as number,
          text: text.trim(),
          id: text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        });
      }
    }
  }
  return headings;
}

export function TableOfContents({ content }: { content: JSONContent }) {
  const headings = extractHeadings(content);
  if (headings.length === 0) return null;

  return (
    <nav className="space-y-1">
      {headings.map((h, i) => (
        <a
          key={`${h.id}-${i}`}
          href={`#${h.id}`}
          className="block text-[13px] leading-snug text-muted-foreground hover:text-foreground transition-colors truncate"
          style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}
