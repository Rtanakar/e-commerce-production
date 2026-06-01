// ============================================================================
// seller-sidebar-provider.tsx — bridges the Zustand store ↔ shadcn Sidebar
// ============================================================================
// shadcn's <SidebarProvider> supports a controlled `open` / `onOpenChange`.
// We wire those to our Zustand store so the store is the single source of
// truth for the desktop expand/collapse, while shadcn keeps owning the mobile
// Sheet, keyboard shortcut, rail, and all the accessibility wiring.
//
// SSR-safety: persisted state only exists in the browser. On the server and
// the first client paint we render `defaultOpen` (expanded); once `persist`
// rehydrates (`hydrated` flips true) we feed the stored preference. This
// avoids a hydration mismatch on the controlled `open` attribute.
// ============================================================================

"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useSidebarStore } from "../store/use-sidebar-store";

export function SellerSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const open = useSidebarStore((s) => s.open);
  const hydrated = useSidebarStore((s) => s.hydrated);
  const setOpen = useSidebarStore((s) => s.setOpen);

  return (
    <SidebarProvider
      // Before rehydration → expanded default (matches SSR). After → store value.
      open={hydrated ? open : true}
      onOpenChange={setOpen}
      // h-svh + overflow-hidden → shell viewport pe fix; sirf <main> scroll kare
      // (warna double scrollbar: body + main dono scroll karte the)
      className="h-svh overflow-hidden"
    >
      {children}
    </SidebarProvider>
  );
}
