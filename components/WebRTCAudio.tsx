"use client";
import { useEffect, useRef } from "react";

/*
 * WebRTCAudio — Invisible, mobile-safe audio element for WebRTC streams.
 *
 * Why this component exists:
 * - iOS Safari requires `playsInline` attribute or audio is completely blocked.
 * - Chrome Android blocks autoplay if there was no prior user gesture on the page.
 * - The "tap-to-play" fallback listens for the FIRST touchstart/click (which
 *   happens naturally when the player taps the game) and triggers .play() then.
 * - We clean up the event listeners immediately after first trigger to avoid
 *   firing on every subsequent tap.
 */
export default function WebRTCAudio({
  remoteStream,
}: {
  remoteStream: MediaStream | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !remoteStream) return;

    // Attach the stream to the audio element
    if (audio.srcObject !== remoteStream) {
      audio.srcObject = remoteStream;
    }

    const forcePlay = () => {
      audio.play().catch(() => {});
      document.removeEventListener("touchstart", forcePlay);
      document.removeEventListener("click", forcePlay);
    };

    // Attempt autoplay — browsers may block this on mobile
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay was blocked (common on iOS Safari & Chrome Android).
        // Register one-shot listeners: the moment the player touches/clicks
        // anywhere (which happens instantly when they tap the game), we play.
        console.warn(
          "[WebRTCAudio] Autoplay blocked — will play on first user gesture.",
          err
        );

        document.addEventListener("touchstart", forcePlay, { passive: true });
        document.addEventListener("click", forcePlay);
      });
    }

    // Cleanup: stop audio when stream changes or component unmounts
    return () => {
      audio.pause();
      audio.srcObject = null;
      document.removeEventListener("touchstart", forcePlay);
      document.removeEventListener("click", forcePlay);
    };
  }, [remoteStream]);

  // Don't render anything if there's no remote stream yet
  if (!remoteStream) return null;

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline   /* CRITICAL for iOS Safari — without this, iPhone stays muted */
      muted={false}
      style={{ display: "none" }}
    />
  );
}
