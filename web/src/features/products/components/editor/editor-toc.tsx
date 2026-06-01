// ============================================================================
// editor-toc.tsx — table of contents (heading anchors, active highlight)
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { AnimatePresence, motion } from "motion/react";
import { Hash, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeadingItem {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  pos: number;
}

function extractHeadings(editor: Editor): HeadingItem[] {
  const items: HeadingItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const level = node.attrs.level as number;
    if (level < 1 || level > 3) return;
    const text = node.textContent.trim();
    if (!text) return;
    items.push({ id: `h-${pos}`, level: level as 1 | 2 | 3, text, pos });
  });
  return items;
}

function findActive(headings: HeadingItem[], selPos: number): string | null {
  let active: string | null = null;
  for (const h of headings) {
    if (h.pos <= selPos) active = h.id;
    else break;
  }
  return active;
}

export function EditorToc({
  editor,
  title = "On this page",
  className,
}: {
  editor: Editor | null;
  title?: string;
  className?: string;
}) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => {
      const next = extractHeadings(editor);
      setHeadings(next);
      setActiveId(findActive(next, editor.state.selection.from));
    };
    refresh();
    editor.on("update", refresh);
    editor.on("selectionUpdate", refresh);
    return () => {
      editor.off("update", refresh);
      editor.off("selectionUpdate", refresh);
    };
  }, [editor]);

  const goTo = (h: HeadingItem) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(h.pos + 1).run();
    const dom = editor.view.nodeDOM(h.pos) as HTMLElement | null;
    dom?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <aside className={cn("w-full rounded-xl border border-border bg-card/40 p-3", className)}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <ListTree className="size-3.5 text-primary" />
        {title}
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {headings.length === 0 ? (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-muted-foreground/70">
            Outline appears here as you add headings.
          </motion.p>
        ) : (
          <motion.ul key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-0.5">
            {headings.map((h) => {
              const isActive = h.id === activeId;
              return (
                <motion.li key={h.id} layout initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.15 }}>
                  <button
                    type="button"
                    onClick={() => goTo(h)}
                    title={h.text}
                    className={cn(
                      "group flex w-full items-start gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-primary/10",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                      h.level === 2 && "pl-5",
                      h.level === 3 && "pl-8",
                    )}
                  >
                    <Hash className={cn("mt-0.5 shrink-0", h.level === 1 ? "size-3.5" : "size-3", isActive ? "text-primary" : "text-muted-foreground/50")} />
                    <span className="line-clamp-2">{h.text}</span>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </aside>
  );
}
