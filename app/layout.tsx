import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { CustomThemeProvider } from "@/lib/theme-provider";
import { fontVariables } from "@/lib/fonts";
import { fontInitScript } from "@/lib/font-options";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "GOA HZ", template: "%s · GOA HZ" },
  description: "Sistem General Affair Lourdes Group: aset, armada & P2H, dan tugas tim GA.",
  applicationName: "GOA HZ",
  appleWebApp: { capable: true, title: "GOA HZ", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#18181b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* font & ukuran tersimpan dipasang sebelum render (anti-flash) */}
        <script dangerouslySetInnerHTML={{ __html: fontInitScript }} />
      </head>
      <body className="antialiased">
        <CustomThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "soft-light", "soft-dark"]}
          disableTransitionOnChange
        >
          {children}
        </CustomThemeProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
