// ============================================================================
// slash-command-menu.tsx — floating `/` menu (portal, keyboard-nav)
// ============================================================================

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { groupSlashItems, type SlashCommandItem } from "./slash-command-items";

interface Props {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  clientRect: (() => DOMRect | null) | null;
}

export interface SlashCommandMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const MENU_WIDTH = 300;
const MENU_MAX_HEIGHT = 340;
const PAD = 8;

export const SlashCommandMenu = forwardRef<SlashCommandMenuHandle, Props>(
  function SlashCommandMenu({ items, command, clientRect }, ref) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => setActiveIndex(0), [items]);

    useLayoutEffect(() => {
      if (!clientRect) return;
      const rect = clientRect();
      if (!rect) return;
      const { innerWidth, innerHeight } = window;
      let top = rect.bottom + 6;
      let left = rect.left;
      if (top + MENU_MAX_HEIGHT > innerHeight - PAD) top = Math.max(PAD, rect.top - MENU_MAX_HEIGHT - 6);
      if (left + MENU_WIDTH > innerWidth - PAD) left = Math.max(PAD, innerWidth - MENU_WIDTH - PAD);
      setCoords({ top, left });
    }, [clientRect, items]);

    useEffect(() => {
      const el = containerRef.current?.querySelector<HTMLButtonElement>(`[data-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (event.key === "ArrowDown") {
          setActiveIndex((i) => (i + 1) % Math.max(1, items.length));
          return true;
        }
        if (event.key === "ArrowUp") {
          setActiveIndex((i) => (i - 1 + Math.max(1, items.length)) % Math.max(1, items.length));
          return true;
        }
        if (event.key === "Enter") {
          const item = items[activeIndex];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (typeof window === "undefined") return null;
    const grouped = groupSlashItems(items);

    return createPortal(
      <AnimatePresence>
        {coords && (
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            style={{ position: "fixed", top: coords.top, left: coords.left, width: MENU_WIDTH, maxHeight: MENU_MAX_HEIGHT, zIndex: 1000 }}
            className="overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-2xl"
          >
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">No matching commands</div>
            ) : (
              grouped.map(({ group, items: gItems }) => (
                <div key={group} className="mb-1 last:mb-0">
                  <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {group}
                  </div>
                  {gItems.map((item) => {
                    const flatIndex = items.findIndex((it) => it.id === item.id);
                    const isActive = flatIndex === activeIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        data-index={flatIndex}
                        type="button"
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => command(item)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                          isActive ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
                            isActive ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    );
  },
);
