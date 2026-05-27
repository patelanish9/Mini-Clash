import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mini Clash — Neon Arcade",
    short_name: "Mini Clash",
    description: "Viral social gaming hub. Battle friends in Neon XO, Rage Tap, and more. Earn coins. Claim glory.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06060f",
    theme_color: "#00f3ff",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: "Neon XO Speedrun",
        url: "/games/xo",
        description: "Play XO with a 3-second shot clock",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Rage Tap Battle",
        url: "/games/rage-tap",
        description: "Split-screen tap battle",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
