"use client";

import { useCallback, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────
   useWakeLock — Prevents phone screen from sleeping during games
   Uses the Screen Wake Lock API (supported on Chrome/Edge/Android)
   Gracefully degrades on unsupported browsers (Safari, Firefox)
───────────────────────────────────────────────────────────── */

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const activeRef = useRef(false); // Track if we WANT the lock (for re-acquire)

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    if (!("wakeLock" in navigator)) return; // Browser doesn't support it

    try {
      sentinelRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
      activeRef.current = true;

      // Listen for release (happens when tab hides or phone locks manually)
      sentinelRef.current.addEventListener("release", () => {
        sentinelRef.current = null;
      });
    } catch {
      // OS denied the request (low battery, etc.) — silently ignore
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    activeRef.current = false;
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch {}
      sentinelRef.current = null;
    }
  }, []);

  // Re-acquire when tab becomes visible again
  // (Wake lock is automatically released when tab is hidden)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && activeRef.current && !sentinelRef.current) {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [requestWakeLock]);

  // Release on component unmount
  useEffect(() => {
    return () => {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
      }
    };
  }, []);

  return { requestWakeLock, releaseWakeLock };
}
