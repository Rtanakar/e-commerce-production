// ============================================================================
// theme-provider.tsx — next-themes wrapper
// ============================================================================
// Single source of truth for light/dark/system. next-themes sets the
// `.dark` class on <html> which Tailwind reads via the `dark:` variant.
//
// `attribute="class"` → toggles class instead of data-attribute (standard)
// `defaultTheme="system"` → respects OS preference on first visit
// `enableSystem` → users can pick "System" in theme toggle
// `disableTransitionOnChange` → prevents flash of unstyled colors on switch
// ============================================================================

"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
