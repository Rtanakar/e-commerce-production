// ============================================================================
// video-node.tsx — TipTap video block (node + React NodeView)
// ============================================================================
// TipTap me built-in video nahi. Atom block node — native <video controls> +
// remove button (select pe). data-r2-key cleanup ke liye. Theme-aware.
// ============================================================================

"use client";

import { useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      setVideo: (attrs: {
        src: string;
        "data-r2-key"?: string | null;
      }) => ReturnType;
    };
  }
}

function VideoView({ node, selected, deleteNode, editor }: NodeViewProps) {
  const src = node.attrs.src as string | null;
  const [confirm, setConfirm] = useState(false);
  return (
    <NodeViewWrapper
      className={cn(
        "group/video relative my-4 overflow-hidden rounded-xl border bg-black transition-all",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
    >
      {src ? (
        <div
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
          className="pointer-events-auto"
        >
          <video
            src={src}
            controls
            playsInline
            preload="metadata"
            className="block w-full"
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
          Video URL missing
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
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-background/80 px-3 py-1 text-xs text-rose-500 opacity-0 backdrop-blur transition-opacity hover:bg-rose-500/15 group-hover/video:opacity-100"
        >
          <Trash2 className="size-3" /> Remove
        </button>
      )}

      <ConfirmDeleteDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove this video?"
        description="The video will be deleted from storage and removed from the description."
        confirmLabel="Remove"
        onConfirm={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}

export const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      "data-r2-key": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-r2-key"),
        renderHTML: (attrs) =>
          attrs["data-r2-key"] ? { "data-r2-key": attrs["data-r2-key"] } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        preload: "metadata",
        class: "tt-video rounded-lg",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },

  addCommands() {
    return {
      setVideo:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
