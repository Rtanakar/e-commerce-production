// ============================================================================
// slash-command-items.ts — registry of all `/` commands
// ============================================================================

import type { Editor, Range } from "@tiptap/core";
import {
  CheckSquare,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
  Video as VideoIcon,
} from "lucide-react";

export type SlashCommandGroup = "Basic" | "Headings" | "Lists" | "Media";

export interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  group: SlashCommandGroup;
  action: (editor: Editor, range: Range) => void;
}

export interface SlashCommandContext {
  uploadHandlers: { image: () => void; video: () => void; file: () => void };
}

export function getSlashCommandItems(ctx: SlashCommandContext): SlashCommandItem[] {
  return [
    { id: "text", title: "Text", description: "Plain paragraph", icon: Type, keywords: ["paragraph", "text", "p"], group: "Basic", action: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
    { id: "divider", title: "Divider", description: "Horizontal line", icon: Minus, keywords: ["hr", "rule", "line", "divider"], group: "Basic", action: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
    { id: "quote", title: "Quote", description: "Blockquote", icon: Quote, keywords: ["quote", "blockquote", ">"], group: "Basic", action: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
    { id: "code", title: "Code block", description: "Monospace code", icon: Code, keywords: ["code", "pre", "```"], group: "Basic", action: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
    { id: "h1", title: "Heading 1", description: "Large section title", icon: Heading1, keywords: ["heading", "h1", "#"], group: "Headings", action: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 1 }).run() },
    { id: "h2", title: "Heading 2", description: "Section heading", icon: Heading2, keywords: ["heading", "h2", "##"], group: "Headings", action: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 2 }).run() },
    { id: "h3", title: "Heading 3", description: "Sub-section", icon: Heading3, keywords: ["heading", "h3", "###"], group: "Headings", action: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 3 }).run() },
    { id: "bullet-list", title: "Bullet list", description: "Unordered list", icon: List, keywords: ["list", "bullet", "ul", "-"], group: "Lists", action: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
    { id: "ordered-list", title: "Numbered list", description: "Ordered list", icon: ListOrdered, keywords: ["list", "numbered", "ol", "1."], group: "Lists", action: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
    { id: "task-list", title: "To-do list", description: "Checkbox list", icon: CheckSquare, keywords: ["task", "todo", "checkbox", "[]"], group: "Lists", action: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
    { id: "image", title: "Image", description: "Upload image", icon: ImageIcon, keywords: ["image", "photo", "img", "upload"], group: "Media", action: (e, r) => { e.chain().focus().deleteRange(r).run(); ctx.uploadHandlers.image(); } },
    { id: "video", title: "Video", description: "Upload video", icon: VideoIcon, keywords: ["video", "mp4", "upload"], group: "Media", action: (e, r) => { e.chain().focus().deleteRange(r).run(); ctx.uploadHandlers.video(); } },
    { id: "file", title: "File", description: "Upload PDF / doc", icon: FileText, keywords: ["file", "pdf", "doc", "attachment"], group: "Media", action: (e, r) => { e.chain().focus().deleteRange(r).run(); ctx.uploadHandlers.file(); } },
  ];
}

export function filterSlashItems(items: SlashCommandItem[], query: string): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.title.toLowerCase().includes(q) ||
      it.id.toLowerCase().includes(q) ||
      it.keywords.some((k) => k.includes(q)),
  );
}

export function groupSlashItems(items: SlashCommandItem[]) {
  const groups = new Map<SlashCommandGroup, SlashCommandItem[]>();
  for (const item of items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return Array.from(groups, ([group, gItems]) => ({ group, items: gItems }));
}
