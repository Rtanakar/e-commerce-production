// ============================================================================
// image-with-key.ts — TipTap Image extension + data-r2-key attribute
// ============================================================================
// Built-in Image ko extend karke R2 object key DOM me track karta hai. Product
// delete pe backend description HTML scan karke `data-r2-key` se orphan media
// cleanup karta hai (backend extractProductKeys).
// ============================================================================

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageView } from "./image-view";

export const ImageWithKey = Image.extend({
  name: "image",
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-r2-key": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-r2-key"),
        renderHTML: (attrs) =>
          attrs["data-r2-key"] ? { "data-r2-key": attrs["data-r2-key"] } : {},
      },
    };
  },
  // React NodeView — editor me hover Remove button (getHTML par asar nahi)
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
}).configure({
  HTMLAttributes: { class: "tt-image rounded-lg" },
  allowBase64: false,
});
