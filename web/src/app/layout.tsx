// ============================================================================
// Root layout - global providers ONLY (no UI chrome)
// ============================================================================
// Per-area chrome lives in route-group layouts:
//   (shop)/layout.tsx    → customer SiteHeader + CategoryBar
//   (seller)/layout.tsx  → minimal seller portal header
//   (auth)/layout.tsx    → centered auth card (own logo bar)
//
// This separation matches how nx monorepos isolate distinct apps - same code
// base, completely independent UIs per audience.
// ============================================================================

import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/lib/providers/query-provider";
import { ThemeProvider } from "@/lib/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eshop",
  description: "Multi-vendor e-commerce platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        geistSans.variable,
        geistMono.variable,
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <QueryProvider>
            <NuqsAdapter>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster />
            </NuqsAdapter>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
