// ============================================================================
// editor-toolbar.tsx — Sticky TipTap toolbar (theme-aware)
// ============================================================================

"use client";

import type { Editor } from "@tiptap/core";
import { AnimatePresence, motion } from "motion/react";
import {
  Bold,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Video as VideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

function TBtn({
  icon: Icon,
  active,
  onClick,
  disabled,
  title,
  spin,
}: {
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md transition-colors",
        "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-primary/15 text-primary",
      )}
    >
      <Icon className={cn("size-4", spin && "animate-spin")} />
    </button>
  );
}

function TDivider() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

export function EditorToolbar({
  editor,
  uploading,
  onImageUpload,
  onVideoUpload,
  onFileUpload,
  onSetLink,
  disabled,
}: {
  editor: Editor | null;
  uploading: "image" | "video" | "file" | null;
  onImageUpload: () => void;
  onVideoUpload: () => void;
  onFileUpload: () => void;
  /** Link modal kholne ka host callback (window.prompt ke bajay) */
  onSetLink?: () => void;
  disabled?: boolean;
}) {
  if (!editor) {
    return (
      <div className="h-11 animate-pulse rounded-t-xl border-b border-border bg-muted/40" />
    );
  }
  const d = !!disabled;

  // Host modal pass kare to wahi; warna safe fallback (prompt) — par editor me
  // hamesha modal callback aata hai.
  const setLink =
    onSetLink ??
    (() => {
      const prev = editor.getAttributes("link").href as string | undefined;
      const url = window.prompt("URL", prev ?? "https://");
      if (url === null) return;
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    });

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-border bg-card/90 px-2 py-1.5 backdrop-blur">
      <TBtn
        icon={Undo2}
        title="Undo"
        disabled={d || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <TBtn
        icon={Redo2}
        title="Redo"
        disabled={d || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
      <TDivider />
      <TBtn
        icon={Heading1}
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        disabled={d}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <TBtn
        icon={Heading2}
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        disabled={d}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <TBtn
        icon={Heading3}
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        disabled={d}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <TDivider />
      <TBtn
        icon={Bold}
        title="Bold"
        active={editor.isActive("bold")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <TBtn
        icon={Italic}
        title="Italic"
        active={editor.isActive("italic")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <TBtn
        icon={UnderlineIcon}
        title="Underline"
        active={editor.isActive("underline")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <TBtn
        icon={Strikethrough}
        title="Strikethrough"
        active={editor.isActive("strike")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <TBtn
        icon={Code}
        title="Inline code"
        active={editor.isActive("code")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <TDivider />
      <TBtn
        icon={List}
        title="Bullet list"
        active={editor.isActive("bulletList")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <TBtn
        icon={ListOrdered}
        title="Numbered list"
        active={editor.isActive("orderedList")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <TBtn
        icon={ListChecks}
        title="Task list"
        active={editor.isActive("taskList")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />
      <TBtn
        icon={Quote}
        title="Quote"
        active={editor.isActive("blockquote")}
        disabled={d}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <TBtn
        icon={Minus}
        title="Divider"
        disabled={d}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <TDivider />
      <TBtn
        icon={LinkIcon}
        title="Link"
        active={editor.isActive("link")}
        disabled={d}
        onClick={setLink}
      />
      <TDivider />
      <TBtn
        icon={uploading === "image" ? Loader2 : ImageIcon}
        spin={uploading === "image"}
        title="Upload image"
        disabled={d || uploading !== null}
        onClick={onImageUpload}
      />
      <TBtn
        icon={uploading === "video" ? Loader2 : VideoIcon}
        spin={uploading === "video"}
        title="Upload video"
        disabled={d || uploading !== null}
        onClick={onVideoUpload}
      />
      <TBtn
        icon={uploading === "file" ? Loader2 : FileText}
        spin={uploading === "file"}
        title="Upload file"
        disabled={d || uploading !== null}
        onClick={onFileUpload}
      />

      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
          >
            <Loader2 className="size-3 animate-spin" />
            Uploading {uploading}…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
