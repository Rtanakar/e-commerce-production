// ============================================================================
// block-handle.tsx — left-margin drag affordance + "add block" (Notion-style)
// ============================================================================

"use client";

import { useState } from "react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Editor } from "@tiptap/core";
import { AnimatePresence, motion } from "motion/react";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function BlockHandle({ editor }: { editor: Editor | null }) {
  const [hovered, setHovered] = useState(false);
  if (!editor) return null;

  // "+ add block" — current node ke neeche empty paragraph + "/" insert → slash menu khulta
  const onAddBlock = () => {
    const { $from } = editor.state.selection;
    const pos = $from.after(1);
    editor
      .chain()
      .focus()
      .insertContentAt(pos, { type: "paragraph", content: [{ type: "text", text: "/" }] })
      .setTextSelection(pos + 2)
      .run();
  };

  return (
    <DragHandle editor={editor}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="-ml-2 flex select-none items-center gap-0.5"
      >
        <button
          type="button"
          onClick={onAddBlock}
          title="Add block below"
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          title="Drag to reorder"
          className="inline-flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.12 }}
              className={cn(
                "pointer-events-none ml-1 hidden whitespace-nowrap rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] text-background backdrop-blur md:inline-block",
              )}
            >
              Drag
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </DragHandle>
  );
}
