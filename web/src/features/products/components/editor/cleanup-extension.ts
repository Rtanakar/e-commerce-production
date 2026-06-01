// ============================================================================
// cleanup-extension.ts — auto-delete R2 objects when nodes are removed
// ============================================================================
// Har transaction pe old vs new doc diff karke gaye hue `data-r2-key` collect
// karta hai → host ke onKeysRemoved ko deta hai (jo deleteMediaBulk call karta).
// appendTransaction returns null → undo/redo safe.
// ============================================================================

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

function collectR2Keys(doc: PMNode): Set<string> {
  const keys = new Set<string>();
  doc.descendants((node) => {
    const key = node.attrs?.["data-r2-key"];
    if (typeof key === "string" && key) keys.add(key);
  });
  return keys;
}

interface CleanupExtensionOptions {
  onKeysRemoved: (keys: string[]) => void;
}

export const CleanupExtension = Extension.create<CleanupExtensionOptions>({
  name: "r2Cleanup",
  addOptions() {
    return { onKeysRemoved: () => {} };
  },
  addProseMirrorPlugins() {
    const onKeysRemoved = this.options.onKeysRemoved;
    return [
      new Plugin({
        key: new PluginKey("r2-cleanup"),
        appendTransaction: (_t, oldState, newState) => {
          if (oldState.doc.eq(newState.doc)) return null;
          const oldKeys = collectR2Keys(oldState.doc);
          const newKeys = collectR2Keys(newState.doc);
          const removed: string[] = [];
          for (const k of oldKeys) if (!newKeys.has(k)) removed.push(k);
          if (removed.length > 0) queueMicrotask(() => onKeysRemoved(removed));
          return null;
        },
      }),
    ];
  },
});
