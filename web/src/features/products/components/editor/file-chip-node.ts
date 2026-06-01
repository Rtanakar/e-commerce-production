// ============================================================================
// file-chip-node.ts — inline file attachment chip (PDF/doc/etc.)
// ============================================================================
// Slash "File" upload → inline atom chip (icon + name + size + ↓). data-r2-key
// for cleanup. Styles in globals.css `.tt-file*`.
// ============================================================================

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileChipView } from "./file-chip-view";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function extFromFilename(filename: string): string {
  const m = filename.match(/\.([a-z0-9]{1,8})$/i);
  return m ? m[1].toUpperCase() : "FILE";
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileChip: {
      setFileChip: (attrs: {
        href: string;
        "data-r2-key": string;
        filename: string;
        sizeBytes?: number;
      }) => ReturnType;
    };
  }
}

export const FileChipNode = Node.create({
  name: "fileChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: null },
      "data-r2-key": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-r2-key"),
      },
      filename: {
        default: null,
        parseHTML: (el) => el.querySelector(".tt-file-name")?.textContent ?? null,
      },
      size: {
        default: null,
        parseHTML: (el) => el.querySelector(".tt-file-size")?.textContent ?? null,
      },
      ext: {
        default: null,
        parseHTML: (el) => el.querySelector(".tt-file-icon")?.textContent ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "a.tt-file" }];
  },

  // React NodeView — editor me hover × Remove (getHTML par asar nahi)
  addNodeView() {
    return ReactNodeViewRenderer(FileChipView);
  },

  renderHTML({ HTMLAttributes, node }) {
    const filename = (node.attrs.filename as string) ?? "file";
    const size = (node.attrs.size as string) ?? "";
    const ext = (node.attrs.ext as string) ?? extFromFilename(filename);
    const href = (node.attrs.href as string) ?? "#";
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: "tt-file",
        href,
        download: filename,
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      ["span", { class: "tt-file-icon" }, ext.slice(0, 4)],
      [
        "span",
        { class: "tt-file-meta" },
        ["span", { class: "tt-file-name" }, filename],
        ...(size ? [["span", { class: "tt-file-size" }, size]] : []),
      ],
      ["span", { class: "tt-file-arrow" }, "↓"],
    ];
  },

  addCommands() {
    return {
      setFileChip:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              href: attrs.href,
              "data-r2-key": attrs["data-r2-key"],
              filename: attrs.filename,
              size: attrs.sizeBytes ? formatBytes(attrs.sizeBytes) : null,
              ext: extFromFilename(attrs.filename),
            },
          }),
    };
  },
});
