"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { WikiEditor } from "@/components/wiki-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Save, ArrowLeft, Check, BookOpen, Clock, AlertCircle,
  Lock, Users, Share2, Globe, History, Tag, User, Calendar,
} from "lucide-react";
import Link from "next/link";
import { updatePageAction } from "../../actions";
import type { JSONContent } from "@tiptap/react";

const VIS_MAP: Record<string, { icon: typeof Lock; label: string; color: string }> = {
  PRIVATE: { icon: Lock, label: "Private", color: "bg-muted text-muted-foreground" },
  HOUSEHOLD: { icon: Users, label: "Household", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
  SHARED: { icon: Share2, label: "Shared", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  PUBLIC: { icon: Globe, label: "Public", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function PageEditor({ pageId, initialTitle, initialContent, authorName, createdByName, updatedAt, createdAt, visibility, wordCount: initialWordCount, versionCount, tags }: {
  pageId: string;
  initialTitle: string;
  initialContent: JSONContent;
  authorName: string;
  createdByName: string;
  updatedAt: string;
  createdAt: string;
  visibility: string;
  wordCount: number;
  versionCount: number;
  tags: string[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const contentRef = useRef<JSONContent>(initialContent);
  const contentTextRef = useRef("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [wordCount, setWordCount] = useState(initialWordCount);
  const [charCount, setCharCount] = useState(0);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const fd = new FormData();
      fd.set("id", pageId);
      fd.set("title", title);
      fd.set("content", JSON.stringify(contentRef.current));
      fd.set("contentText", contentTextRef.current);
      await updatePageAction(fd);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // Action failed
    } finally {
      setSaving(false);
    }
  }, [pageId, title, saving]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const handleContentChange = useCallback((json: JSONContent, text: string) => {
    contentRef.current = json;
    contentTextRef.current = text;
    setDirty(true);
    setWordCount(countWords(text));
    setCharCount(text.length);
  }, []);

  const readTime = useMemo(() => {
    const mins = Math.max(1, Math.ceil(wordCount / 200));
    return `${mins} min`;
  }, [wordCount]);

  const vis = VIS_MAP[visibility] || VIS_MAP.HOUSEHOLD;
  const VisIcon = vis.icon;

  return (
    <div className="flex gap-6 max-w-[1200px]">
      {/* ─── Main Editor Column ─── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href={`/wiki/${pageId}`}>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Badge className={`${vis.color} text-[10px] font-medium border-0`}>
              <VisIcon className="size-2.5 mr-1" />{vis.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {dirty && !saving && !saved && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="size-3" /> Unsaved changes
              </span>
            )}
            {saved && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="size-3.5" /> Saved
              </span>
            )}
            <Button onClick={handleSave} disabled={saving} variant={dirty ? "default" : "secondary"} size="sm" className="h-8 gap-1.5">
              <Save className="size-3.5" />{saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Title input */}
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="wiki-title text-3xl md:text-4xl w-full py-2 border-none shadow-none focus-visible:outline-none bg-transparent placeholder:text-muted-foreground/40"
          placeholder="Page title..."
        />

        {/* Editor */}
        <WikiEditor content={initialContent} onChange={handleContentChange} />
      </div>

      {/* ─── Side Panel ─── */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-6 space-y-5">
          {/* Document info */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Document</h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                <User className="size-3.5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-[11px] text-muted-foreground">Created by</div>
                  <div className="font-medium text-[13px]">{createdByName}</div>
                  <div className="text-[11px] text-muted-foreground">{createdAt}</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <User className="size-3.5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-[11px] text-muted-foreground">Last edited by</div>
                  <div className="font-medium text-[13px]">{authorName}</div>
                  <div className="text-[11px] text-muted-foreground">{updatedAt}</div>
                </div>
              </div>
            </div>

            <Separator className="opacity-40" />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><BookOpen className="size-3" /> Words</div>
                <div className="text-sm font-semibold tabular-nums">{wordCount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="size-3" /> Read</div>
                <div className="text-sm font-semibold">{readTime}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><History className="size-3" /> Versions</div>
                <div className="text-sm font-semibold">{versionCount}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"># Chars</div>
                <div className="text-sm font-semibold tabular-nums">{charCount.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <>
              <Separator className="opacity-40" />
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Tag className="size-3" /> Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Shortcuts */}
          <Separator className="opacity-40" />
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Shortcuts</h3>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between"><span>Save</span><kbd className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">Ctrl+S</kbd></div>
              <div className="flex justify-between"><span>Bold</span><kbd className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">Ctrl+B</kbd></div>
              <div className="flex justify-between"><span>Italic</span><kbd className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">Ctrl+I</kbd></div>
              <div className="flex justify-between"><span>Underline</span><kbd className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">Ctrl+U</kbd></div>
              <div className="flex justify-between"><span>Link</span><kbd className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">Ctrl+K</kbd></div>
              <div className="flex justify-between"><span>Undo</span><kbd className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">Ctrl+Z</kbd></div>
              <div className="flex justify-between"><span>Hard break</span><kbd className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">Shift+Enter</kbd></div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
