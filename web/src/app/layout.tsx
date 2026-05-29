import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/lib/providers/query-provider";
import { ThemeProvider } from "@/lib/providers/theme-provider";
// import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/shared/site-header";
import { Toaster } from "sonner";

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
      // suppressHydrationWarning required - next-themes injects `.dark` class
      // before React hydrates, causing a controlled mismatch that's expected
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        geistSans.variable,
        geistMono.variable,
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Provider order: Theme (innermost class-on-html) → Query (data) */}
        <ThemeProvider>
          <QueryProvider>
            <SiteHeader />
            {children}
          </QueryProvider>

          {/* <Toaster /> */}
          <Toaster
            position="bottom-right"
            closeButton
            duration={4500}
            toastOptions={{
              unstyled: false,
              classNames: {
                toast:
                  "!bg-[#181312] !border !border-[#FFFFFF1A] !text-[#FFF7EC] !shadow-[0_8px_32px_rgba(0,0,0,0.45)] !rounded-xl",
                title: "!text-[#FFF7EC] !font-semibold",
                description: "!text-[#FFF7EC]/70",
                actionButton: "!bg-[#FF5A1F] !text-[#0E0A07]",
                cancelButton: "!bg-[#FFF7EC]/10 !text-[#FFF7EC]",
                closeButton:
                  "!bg-[#181312] !border !border-[#FFFFFF1A] !text-[#FFF7EC]",
                success: "!border-[#1F7A3A]/40",
                error: "!border-[#B3321B]/50",
              },
              style: {
                fontFamily: "var(--font-sans)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
