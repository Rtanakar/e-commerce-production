// ============================================================================
// bubble-menu-content.tsx — selection toolbar (heading + marks + link + color)
// ============================================================================

"use client";

import type { Editor } from "@tiptap/core";
import {
  Bold,
  Check,
  ChevronDown,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  Palette,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TEXT_COLORS } from "./colors";

function MenuBtn({
  icon: Icon,
  active,
  onClick,
  title,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick: () => void;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-sm transition-colors",
        "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
        active && "bg-primary/15 text-primary",
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

export function BubbleMenuContent({
  editor,
  onSetLink,
}: {
  editor: Editor;
  /** Link modal kholne ka host callback (window.prompt ke bajay) */
  onSetLink?: () => void;
}) {
  const headingLabel = editor.isActive("heading", { level: 1 })
    ? "H1"
    : editor.isActive("heading", { level: 2 })
      ? "H2"
      : editor.isActive("heading", { level: 3 })
        ? "H3"
        : "Text";

  const currentColor = editor.getAttributes("textStyle").color as string | undefined;

  // Modal callback host se; fallback prompt (editor me hamesha modal aata hai)
  const onToggleLink =
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
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-2xl">
      {/* Heading dropdown */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Block type"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            {headingLabel}
            <ChevronDown className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-44 p-1">
          <MenuBtn icon={Type} active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()} title="Text">
            <span className="ml-1">Text</span>
          </MenuBtn>
          <MenuBtn icon={Heading1} active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
            <span className="ml-1">Heading 1</span>
          </MenuBtn>
          <MenuBtn icon={Heading2} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
            <span className="ml-1">Heading 2</span>
          </MenuBtn>
          <MenuBtn icon={Heading3} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
            <span className="ml-1">Heading 3</span>
          </MenuBtn>
        </PopoverContent>
      </Popover>

      <Divider />

      <MenuBtn icon={Bold} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" />
      <MenuBtn icon={Italic} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" />
      <MenuBtn icon={UnderlineIcon} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" />
      <MenuBtn icon={Strikethrough} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough" />
      <MenuBtn icon={Code} active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code" />

      <Divider />

      <MenuBtn icon={LinkIcon} active={editor.isActive("link")} onClick={onToggleLink} title="Link" />

      {/* Color picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Text color"
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground",
              currentColor && "text-foreground",
            )}
          >
            <Palette className="size-4" />
            <span className="size-3 rounded-full border border-border" style={{ background: currentColor || "transparent" }} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-56 p-2">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Text color</div>
          <div className="grid grid-cols-6 gap-1">
            {TEXT_COLORS.map((c) => {
              const isActive = (currentColor ?? "") === c.value || (!currentColor && c.id === "default");
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() =>
                    c.value
                      ? editor.chain().focus().setColor(c.value).run()
                      : editor.chain().focus().unsetColor().run()
                  }
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-md border transition-all",
                    isActive ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/30",
                  )}
                  style={{
                    background:
                      c.value ||
                      "repeating-linear-gradient(45deg,var(--muted) 0 4px,transparent 4px 8px)",
                  }}
                >
                  {isActive && <Check className="size-3 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Divider />

      <MenuBtn icon={Eraser} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting" />
    </div>
  );
}
