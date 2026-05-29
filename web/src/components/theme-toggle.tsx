// ============================================================================
// theme-toggle.tsx — Animated light/dark toggle (Vercel/Linear pattern)
// ============================================================================
// Three states cycled: light → dark → system → light
// Motion: sun ↔ moon crossfade + rotate + scale (springy, ~250ms)
// Hydration-safe: avoid SSR mismatch by rendering placeholder until mounted.
// ============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

// Resolves the icon for the CURRENT active theme (visual cue for user)
function getIcon(theme: string | undefined) {
  if (theme === "dark") return Moon;
  if (theme === "system") return Monitor;
  return Sun;
}

// Cycle order: light → dark → system → light (Linear/Vercel pattern)
function nextTheme(current: string | undefined): "light" | "dark" | "system" {
  if (current === "light") return "dark";
  if (current === "dark") return "system";
  return "light";
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // SSR-safe: render nothing until client mounts (prevents hydration mismatch
  // because server doesn't know user's actual theme preference)
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="inline-flex size-10 items-center justify-center rounded-full"
        aria-hidden
      />
    );
  }

  const Icon = getIcon(theme);
  const next = nextTheme(theme);
  const label = `Switch to ${next} theme (current: ${theme})`;

  return (
    <motion.button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      // Springy tap feedback - users love this micro-interaction
      whileTap={{ scale: 0.9, rotate: -8 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn(
        "relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full",
        "transition-colors hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* AnimatePresence + key=theme triggers crossfade when icon changes.
          mode="wait" ensures old icon exits BEFORE new enters (no overlap) */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Icon className="size-5" />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
