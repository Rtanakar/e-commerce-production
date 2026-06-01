// ============================================================================
// product-description-editor.tsx — Notion-grade TipTap editor (full features)
// ============================================================================
// description = TipTap HTML string (JSON nahi). Features:
//   - StarterKit (+ Underline/Link) + TaskList + TextStyle/Color
//   - ImageWithKey + VideoNode + FileChipNode (data-r2-key cleanup)
//   - SlashCommand (`/`), BlockHandle (drag + add), BubbleMenu, EditorToc
//   - CleanupExtension → node hatne pe R2 se media delete (deleteMediaBulk)
//   - Image/video/file upload (R2 optimize) via toolbar + slash menu
// Theme-aware (shadcn tokens). External value sync for edit mode.
// ============================================================================

"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  uploadImage,
  uploadVideo,
  uploadFile,
  deleteMediaBulk,
} from "@/lib/upload-media";
import { ImageWithKey } from "./image-with-key";
import { VideoNode } from "./video-node";
import { FileChipNode } from "./file-chip-node";
import { SlashCommand } from "./slash-command";
import { CleanupExtension } from "./cleanup-extension";
import { EditorToolbar } from "./editor-toolbar";
import { BlockHandle } from "./block-handle";
import { BubbleMenuContent } from "./bubble-menu-content";
import { EditorToc } from "./editor-toc";
import { LinkDialog } from "./link-dialog";

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showToc?: boolean;
}

// ============================================================================
// stripPastedColors — Notion-like paste: inline color/bg styles hatao
// ============================================================================
// Bahar se (Word/Docs/websites) copy karne pe text apne color ke saath aata
// hai jo dark theme pe black/invisible dikhta hai. Yahan sirf color + background
// strip karte hain — bold/italic/heading/list/link formatting bachi rehti hai.
// TipTap ke parse karne se PEHLE chalega (transformPastedHTML) → Color mark bhi
// nahi banega.
function stripPastedColors(html: string): string {
  if (typeof window === "undefined" || !html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    el.style.removeProperty("color");
    el.style.removeProperty("background-color");
    el.style.removeProperty("background");
    el.style.removeProperty("-webkit-text-fill-color");
    if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
  });
  // legacy <font color> + color attrs
  doc.querySelectorAll("font[color], [color]").forEach((el) =>
    el.removeAttribute("color"),
  );
  return doc.body.innerHTML;
}

const NOOP = { image: () => {}, video: () => {}, file: () => {} };

export function ProductDescriptionEditor({
  value,
  onChange,
  disabled,
  placeholder = "Type / for commands · drag the handle to reorder blocks",
  showToc = true,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"image" | "video" | "file" | null>(null);
  // Link modal state (window.prompt ki jagah)
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // Restore guard — setContent (edit hydrate) ke beech cleanup mute
  const isRestoringRef = useRef(false);

  // Slash menu upload handlers ref (render-time ref read avoid)
  const handlersRef = useRef(NOOP);
  useEffect(() => {
    handlersRef.current = {
      image: () => imageInputRef.current?.click(),
      video: () => videoInputRef.current?.click(),
      file: () => fileInputRef.current?.click(),
    };
    return () => {
      handlersRef.current = NOOP;
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, HTMLAttributes: { class: "tt-link" } },
        codeBlock: { HTMLAttributes: { class: "tt-code-block" } },
        blockquote: { HTMLAttributes: { class: "tt-blockquote" } },
        bulletList: { HTMLAttributes: { class: "tt-bullet-list" } },
        orderedList: { HTMLAttributes: { class: "tt-ordered-list" } },
      }),
      Placeholder.configure({ placeholder, includeChildren: true }),
      TaskList.configure({ HTMLAttributes: { class: "tt-task-list" } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: "tt-task-item" } }),
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      ImageWithKey,
      VideoNode,
      FileChipNode,
      SlashCommand.configure({
        context: {
          uploadHandlers: {
            image: () => handlersRef.current.image(),
            video: () => handlersRef.current.video(),
            file: () => handlersRef.current.file(),
          },
        },
      }),
      CleanupExtension.configure({
        onKeysRemoved: (keys) => {
          if (isRestoringRef.current) return;
          const p = deleteMediaBulk(keys);
          toast.promise(p, {
            loading: keys.length === 1 ? "Removing from storage…" : `Removing ${keys.length} items…`,
            success: () => (keys.length === 1 ? "Removed" : `${keys.length} items removed`),
            error: "Cleanup failed",
          });
        },
      }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn("tt-editor tiptap max-w-none px-6 py-5", "focus:outline-none min-h-[320px]"),
      },
      // Notion-like paste — bahar se aaye color/bg styles strip (theme color me aaye)
      transformPastedHTML: (html) => stripPastedColors(html),
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // External value sync (edit form data lands after mount)
  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? "";
    const current = editor.getHTML();
    const norm = (s: string) => (s === "<p></p>" ? "" : s);
    if (norm(incoming) !== norm(current)) {
      isRestoringRef.current = true;
      editor.commands.setContent(incoming, { emitUpdate: false });
      queueMicrotask(() => {
        isRestoringRef.current = false;
      });
    }
  }, [editor, value]);

  // ─── Upload handlers ───
  const handleImage = async (file?: File) => {
    if (!file || !editor) return;
    setUploading("image");
    try {
      const r = await toast.promise(uploadImage(file, { kind: "product-content-image" }), {
        loading: "Optimizing & uploading image…",
        success: "Image inserted",
        error: (e) => (e instanceof Error ? e.message : "Upload failed"),
      }).unwrap();
      editor
        .chain()
        .focus()
        .setImage({ src: r.url, alt: file.name, "data-r2-key": r.key } as never)
        .run();
    } catch {
      /* toast shown */
    } finally {
      setUploading(null);
    }
  };

  const handleVideo = async (file?: File) => {
    if (!file || !editor) return;
    setUploading("video");
    try {
      const r = await toast.promise(uploadVideo(file), {
        loading: "Uploading video…",
        success: "Video inserted",
        error: (e) => (e instanceof Error ? e.message : "Upload failed"),
      }).unwrap();
      editor.chain().focus().setVideo({ src: r.url, "data-r2-key": r.key }).run();
    } catch {
      /* toast shown */
    } finally {
      setUploading(null);
    }
  };

  const handleFile = async (file?: File) => {
    if (!file || !editor) return;
    setUploading("file");
    try {
      const r = await toast.promise(uploadFile(file), {
        loading: "Uploading file…",
        success: "File attached",
        error: (e) => (e instanceof Error ? e.message : "Upload failed"),
      }).unwrap();
      editor
        .chain()
        .focus()
        .setFileChip({
          href: r.url,
          "data-r2-key": r.key,
          filename: file.name,
          sizeBytes: file.size,
        })
        .run();
    } catch {
      /* toast shown */
    } finally {
      setUploading(null);
    }
  };

  // ─── Link modal handlers ───
  const openLink = () => {
    if (!editor) return;
    setLinkUrl((editor.getAttributes("link").href as string) ?? "");
    setLinkOpen(true);
  };
  const applyLink = (url: string) => {
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  };
  const removeLink = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  if (!editor) {
    return <div className="min-h-[360px] animate-pulse rounded-xl border border-border bg-muted/30" />;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        showToc && "lg:grid-cols-[1fr_200px]",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {/* Editor column */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card/40 transition-colors focus-within:border-primary/50">
        <EditorToolbar
          editor={editor}
          uploading={uploading}
          onImageUpload={() => imageInputRef.current?.click()}
          onVideoUpload={() => videoInputRef.current?.click()}
          onFileUpload={() => fileInputRef.current?.click()}
          onSetLink={openLink}
          disabled={disabled}
        />

        <EditorContent editor={editor} />

        <BlockHandle editor={editor} />

        <BubbleMenu editor={editor} className="z-30">
          <BubbleMenuContent editor={editor} onSetLink={openLink} />
        </BubbleMenu>

        <LinkDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          initialUrl={linkUrl}
          onApply={applyLink}
          onRemove={removeLink}
        />

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            void handleImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            void handleVideo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={[
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/zip",
            "application/json",
            "text/plain",
            "text/markdown",
            "text/csv",
          ].join(",")}
          hidden
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {showToc && (
        <EditorToc editor={editor} className="hidden lg:sticky lg:top-4 lg:block lg:self-start" />
      )}
    </div>
  );
}
