import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Mini Clash — Neon Arcade Gaming Hub",
  description:
    "The viral social gaming hub. Battle friends in Neon XO Speedrun, Rage Tap Battle, and more. Earn coins. Claim glory.",
  keywords: ["mini games", "arcade", "neon", "tic tac toe", "tap battle", "multiplayer"],
  openGraph: {
    title: "Mini Clash — Neon Arcade",
    description: "Play viral mini-games with friends. Earn coins. Dominate.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#06060f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-[#06060f] text-[#e8e8ff] overflow-x-hidden antialiased">
        <ServiceWorkerRegistrar />
        {/* CRT Vignette overlay */}
        <div className="crt-vignette" aria-hidden="true" />
        {/* Scanline crawl */}
        <div className="scanline-overlay fixed inset-0 pointer-events-none z-[9999]" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

