import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { loadBaseData } from "@/lib/load-event";
import { EventProvider } from "@/components/providers/event-provider";
import { WalkProvider } from "@/components/providers/walk-provider";
import { AppChrome } from "@/components/uw/app-chrome";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "URBAN WALK",
  description: "Don't just walk through the city. Understand the city. A field guide for organised urban walks.",
  applicationName: "Urban Walk",
  appleWebApp: { capable: true, title: "Urban Walk", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: the on-screen keyboard shrinks the layout instead of covering the composer
  interactiveWidget: "resizes-content",
  // light screens; home and sign-in override with night (see their page files)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1012" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const base = await loadBaseData();
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        <EventProvider base={base}>
          <WalkProvider>
            <AppChrome>{children}</AppChrome>
          </WalkProvider>
        </EventProvider>
      </body>
    </html>
  );
}
