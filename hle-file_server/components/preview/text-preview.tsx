"use client";

import { useEffect, useState } from "react";

export function TextPreview({
  fileId,
  filename,
}: {
  fileId: string;
  filename: string;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/files/serve/${fileId}`)
      .then((res) => res.text())
      .then((text) => {
        setContent(
          text.length > 102400
            ? text.substring(0, 102400) + "\n\n... (truncated)"
            : text
        );
        setLoading(false);
      })
      .catch(() => {
        setContent("Failed to load file");
        setLoading(false);
      });
  }, [fileId]);

  if (loading) return <div className="animate-pulse bg-muted h-96 rounded-lg" />;

  return (
    <div className="rounded-lg border bg-muted/50 overflow-auto max-h-[80vh]">
      <div className="p-4 border-b bg-muted/80 text-sm text-muted-foreground font-mono">
        {filename}
      </div>
      <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  );
}
