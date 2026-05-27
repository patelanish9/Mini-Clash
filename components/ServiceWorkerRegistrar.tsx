"use client";

import { useEffect } from "react";

/* ─────────────────────────────────────────────────────────────
   ServiceWorkerRegistrar
   Registers the service worker on first render (client-only).
   Rendered as a null component inside RootLayout.
───────────────────────────────────────────────────────────── */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production — dev mode causes HMR conflicts
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Registration failed silently — app still works without SW
      });
  }, []);

  return null;
}
