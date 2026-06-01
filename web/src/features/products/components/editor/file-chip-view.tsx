// ============================================================================
// file-chip-view.tsx — inline NodeView for file attachment chip (Remove + confirm)
// ============================================================================
// Inline atom chip — hover pe chhota × Remove. Confirm modal ke baad deleteNode()
// → CleanupExtension R2 delete + toast. getHTML par asar nahi (renderHTML <a>).
// ============================================================================

"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";

export function FileChipView({ node, selected, deleteNode, editor }: NodeViewProps) {
  const href = (node.attrs.href as string) ?? "#";
  const filename = (node.attrs.filename as string) ?? "file";
  const size = (node.attrs.size as string) ?? "";
  const ext = ((node.attrs.ext as string) ?? "FILE").slice(0, 4);
  const [confirm, setConfirm] = useState(false);

  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={cn(
        "tt-file group/file relative",
        selected && "ring-2 ring-primary/40",
      )}
    >
      <span className="tt-file-icon">{ext}</span>
      <span className="tt-file-meta">
        <a
          href={href}
          download={filename}
          target="_blank"
          rel="noopener noreferrer"
          className="tt-file-name"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {filename}
        </a>
        {size && <span className="tt-file-size">{size}</span>}
      </span>

      {editor.isEditable ? (
        <button
          type="button"
          title="Remove file"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            setConfirm(true);
          }}
          className="ml-1 inline-flex size-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-rose-500/15 hover:text-rose-500 group-hover/file:opacity-100"
        >
          <X className="size-3" />
        </button>
      ) : (
        <span className="tt-file-arrow">↓</span>
      )}

      <ConfirmDeleteDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove this file?"
        description="The file will be deleted from storage and removed from the description."
        confirmLabel="Remove"
        onConfirm={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}
