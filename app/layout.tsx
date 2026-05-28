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
  // PWA manifest declared in app/manifest.ts — no manual link needed
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // Make status bar transparent so our bg bleeds through notch
    title: "Mini Clash",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,     // Prevents pinch-zoom — feels like a native app
  userScalable: false,
  themeColor: "#06060f",
  // viewportFit=cover lets our content fill the notch area;
  // we manually pad with env(safe-area-inset-*) utilities.
  viewportFit: "cover",
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

      {/*
       * Body-level native-app locks (all defined in globals.css body block):
       *   overscroll-behavior: none  → kills pull-to-refresh / iOS rubber-band
       *   user-select: none          → kills blue text-selection on fast taps
       *   touch-action: manipulation → kills 300ms double-tap-to-zoom delay
       *   -webkit-tap-highlight-color: transparent → kills grey flash on tap
       *
       * min-h-[100dvh] here ensures body fills dynamic viewport even when the
       * address bar is visible (100vh would fall short on mobile browsers).
       */}
      <body className="min-h-[100dvh] bg-[#06060f] text-[#e8e8ff] overflow-x-hidden antialiased">
        <ServiceWorkerRegistrar />

        {/* CRT Vignette — full-bleed, sits above everything except modals */}
        <div className="crt-vignette" aria-hidden="true" />

        {/* Scanline crawl */}
        <div
          className="scanline-overlay fixed inset-0 pointer-events-none z-[9999]"
          aria-hidden="true"
        />

        {/*
         * ── App Shell ──────────────────────────────────────────────────────
         * max-w-md  → caps layout at 448px on desktop, full-width on mobile
         * h-[100dvh] → dynamic viewport height (not 100vh!) — survives the
         *              address-bar resize on iOS/Android without clipping
         * safe-y    → pads top & bottom with env(safe-area-inset-*) so
         *              nothing hides behind iPhone notch or Android home bar
         * overflow-hidden → children scroll internally; no page-level scroll
         * ─────────────────────────────────────────────────────────────────
         */}
        <div className="app-shell safe-y">
          {children}
        </div>
      </body>
    </html>
  );
}
