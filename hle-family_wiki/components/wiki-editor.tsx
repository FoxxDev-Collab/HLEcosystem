"use client";

import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, Code, Table as TableIcon, Link as LinkIcon,
  Highlighter, Undo, Redo, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  ImageIcon, Palette, Pilcrow, RemoveFormatting, WrapText,
  TableCellsMerge, Rows3, Columns3, Trash2,
} from "lucide-react";
import { useState, useCallback } from "react";
import type { JSONContent } from "@tiptap/react";

const TEXT_COLORS = [
  { name: "Default", value: "" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Amber", value: "#d97706" },
  { name: "Green", value: "#16a34a" },
  { name: "Teal", value: "#0d9488" },
  { name: "Blue", value: "#2563eb" },
  { name: "Purple", value: "#9333ea" },
  { name: "Pink", value: "#db2777" },
  { name: "Gray", value: "#6b7280" },
];

function ToolbarButton({ onClick, active, title, disabled, children }: {
  onClick: () => void; active?: boolean; title: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <Button type="button" variant="ghost" size="icon" disabled={disabled}
      className={`h-7 w-7 rounded-sm ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"} disabled:opacity-30`}
      onClick={onClick} title={title}
    >{children}</Button>
  );
}

function ToolbarSep() {
  return <Separator orientation="vertical" className="h-5 mx-0.5" />;
}

function ColorPicker({ currentColor, onSelect }: { currentColor: string; onSelect: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <ToolbarButton onClick={() => setOpen(!open)} active={!!currentColor} title="Text color">
        <div className="flex flex-col items-center">
          <Palette className="size-3" />
          <div className="h-0.5 w-3 rounded-full mt-px" style={{ backgroundColor: currentColor || "currentColor" }} />
        </div>
      </ToolbarButton>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1 w-fit">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              title={c.name}
              className="h-6 w-6 rounded-sm border border-border/60 hover:scale-110 transition-transform flex items-center justify-center"
              style={{ backgroundColor: c.value || "transparent" }}
              onClick={() => { onSelect(c.value); setOpen(false); }}
            >
              {c.value === "" && <span className="text-[9px] text-muted-foreground">Aa</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WikiEditor({ content, onChange, editable = true }: {
  content: JSONContent;
  onChange: (json: JSONContent, text: string) => void;
  editable?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "wiki-link" } }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: "Start writing... (type / for commands)" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Superscript,
      Subscript,
      TextStyle,
      Color,
      Image.configure({ inline: false, allowBase64: true }),
      Typography,
      CharacterCount,
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => onChange(ed.getJSON(), ed.getText()),
    editorProps: {
      attributes: { class: "tiptap prose prose-sm max-w-none focus:outline-none" },
      handleDrop: (view, event) => {
        // Handle image drops
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                const { tr } = view.state;
                const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
                if (pos !== undefined) {
                  const node = view.state.schema.nodes.image.create({ src: reader.result });
                  view.dispatch(tr.insert(pos, node));
                }
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        // Handle image pastes
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of items) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") {
                    const { tr, selection } = view.state;
                    const node = view.state.schema.nodes.image.create({ src: reader.result });
                    view.dispatch(tr.replaceSelectionWith(node));
                  }
                };
                reader.readAsDataURL(file);
              }
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = prompt("Enter URL:", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const handleAddImage = useCallback(() => {
    if (!editor) return;
    const url = prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  if (!editable) {
    return (
      <div className="wiki-viewer">
        <EditorContent editor={editor} />
      </div>
    );
  }

  const isInTable = editor.isActive("table");
  const charCount = editor.storage.characterCount;

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-card">
      {/* ─── Toolbar Row 1: Text formatting ─── */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-muted/40 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1">
          {/* Text style */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)"><Bold className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)"><Italic className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)"><UnderlineIcon className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough"><Strikethrough className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight"><Highlighter className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="Superscript"><SuperscriptIcon className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="Subscript"><SubscriptIcon className="size-3.5" /></ToolbarButton>
          <ColorPicker
            currentColor={editor.getAttributes("textStyle").color || ""}
            onSelect={(color) => {
              if (color) {
                editor.chain().focus().setColor(color).run();
              } else {
                editor.chain().focus().unsetColor().run();
              }
            }}
          />

          <ToolbarSep />

          {/* Headings */}
          <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph") && !editor.isActive("heading")} title="Normal text"><Pilcrow className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1"><Heading1 className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2"><Heading2 className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3"><Heading3 className="size-3.5" /></ToolbarButton>

          <ToolbarSep />

          {/* Alignment */}
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left"><AlignLeft className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center"><AlignCenter className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right"><AlignRight className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify"><AlignJustify className="size-3.5" /></ToolbarButton>

          <ToolbarSep />

          {/* Lists */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list"><List className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list"><ListOrdered className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Task list"><ListChecks className="size-3.5" /></ToolbarButton>

          <ToolbarSep />

          {/* Blocks & inserts */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote"><Quote className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block"><Code className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule"><Minus className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={handleSetLink} active={editor.isActive("link")} title="Insert link"><LinkIcon className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={handleAddImage} title="Insert image (URL)"><ImageIcon className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table"><TableIcon className="size-3.5" /></ToolbarButton>

          <ToolbarSep />

          {/* Clear formatting */}
          <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting"><RemoveFormatting className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHardBreak().run()} title="Line break (Shift+Enter)"><WrapText className="size-3.5" /></ToolbarButton>

          <div className="flex-1" />

          {/* Undo / Redo */}
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)"><Undo className="size-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)"><Redo className="size-3.5" /></ToolbarButton>
        </div>

        {/* ─── Table controls (conditional) ─── */}
        {isInTable && (
          <div className="flex items-center gap-0.5 px-2 py-1 border-t border-border/40 bg-muted/20">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mr-2">Table</span>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column after"><Columns3 className="size-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row after"><Rows3 className="size-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column"><Columns3 className="size-3.5 text-destructive" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row"><Rows3 className="size-3.5 text-destructive" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().mergeCells().run()} title="Merge cells"><TableCellsMerge className="size-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().splitCell().run()} title="Split cell"><TableCellsMerge className="size-3.5" /></ToolbarButton>
            <ToolbarSep />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Toggle header row"><Rows3 className="size-3.5" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table"><Trash2 className="size-3.5 text-destructive" /></ToolbarButton>
          </div>
        )}
      </div>

      {/* ─── Bubble Menu (selection formatting) ─── */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }} className="flex items-center gap-0.5 rounded-lg border border-border bg-popover shadow-lg px-1.5 py-1">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold"><Bold className="size-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic"><Italic className="size-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline"><UnderlineIcon className="size-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strike"><Strikethrough className="size-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight"><Highlighter className="size-3.5" /></ToolbarButton>
        <ToolbarSep />
        <ToolbarButton onClick={handleSetLink} active={editor.isActive("link")} title="Link"><LinkIcon className="size-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code"><Code className="size-3.5" /></ToolbarButton>
      </BubbleMenu>

      {/* ─── Editor content ─── */}
      <div className="p-5 md:p-8 min-h-[500px]">
        <EditorContent editor={editor} />
      </div>

      {/* ─── Status bar ─── */}
      <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{charCount?.words() ?? 0} words</span>
          <span>{charCount?.characters() ?? 0} characters</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ctrl+S to save</span>
          <span>Drag or paste images</span>
        </div>
      </div>
    </div>
  );
}

export function WikiViewer({ content }: { content: JSONContent }) {
  return <WikiEditor content={content} onChange={() => {}} editable={false} />;
}
