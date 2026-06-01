// ============================================================================
// image-view.tsx — React NodeView for editor images (hover Remove + confirm)
// ============================================================================
// ImageWithKey ke liye NodeView — selection/hover pe Remove button. Confirm
// modal ke baad deleteNode() → CleanupExtension R2 se delete + toast karta hai.
// getHTML par asar nahi (renderHTML <img> hi deta hai) — NodeView sirf editor
// display ke liye.
// ============================================================================

"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";

export function ImageView({ node, selected, deleteNode, editor }: NodeViewProps) {
  const src = node.attrs.src as string | null;
  const alt = (node.attrs.alt as string | null) ?? "";
  const [confirm, setConfirm] = useState(false);

  return (
    <NodeViewWrapper
      className={cn(
        "group/img relative my-4 w-fit max-w-full overflow-hidden rounded-xl border transition-all",
        selected ? "border-primary ring-2 ring-primary/40" : "border-transparent",
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="tt-image block max-w-full rounded-lg"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center px-6 text-sm text-muted-foreground">
          Image URL missing
        </div>
      )}

      {editor.isEditable && (
        <button
          type="button"
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            setConfirm(true);
          }}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-background/80 px-3 py-1 text-xs text-rose-500 opacity-0 backdrop-blur transition-opacity hover:bg-rose-500/15 group-hover/img:opacity-100"
        >
          <Trash2 className="size-3" /> Remove
        </button>
      )}

      <ConfirmDeleteDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove this image?"
        description="The image will be deleted from storage and removed from the description."
        confirmLabel="Remove"
        onConfirm={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}
