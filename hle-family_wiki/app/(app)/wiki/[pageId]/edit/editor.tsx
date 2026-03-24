"use client";

import { useState, useRef } from "react";
import { WikiEditor } from "@/components/wiki-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { updatePageAction } from "../../actions";
import type { JSONContent } from "@tiptap/react";

export function PageEditor({ pageId, initialTitle, initialContent }: {
  pageId: string; initialTitle: string; initialContent: JSONContent;
}) {
  const [title, setTitle] = useState(initialTitle);
  const contentRef = useRef<JSONContent>(initialContent);
  const contentTextRef = useRef("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const fd = new FormData();
    fd.set("id", pageId);
    fd.set("title", title);
    fd.set("content", JSON.stringify(contentRef.current));
    fd.set("contentText", contentTextRef.current);
    await updatePageAction(fd);
    setSaving(false);
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/wiki/${pageId}`}><Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" /> Back</Button></Link>
        <Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving ? "Saving..." : "Save"}</Button>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-2xl font-bold h-auto py-2 border-none shadow-none focus-visible:ring-0 px-0" placeholder="Page title..." />
      <WikiEditor content={initialContent} onChange={(json, text) => { contentRef.current = json; contentTextRef.current = text; }} />
    </div>
  );
}
