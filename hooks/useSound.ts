import { useCallback, useRef } from "react";
import { usePlayerStats } from "./usePlayerStats";
import { getAudioPackById } from "@/lib/gameStore";

/* ─────────────────────────────────────────────────────────────
   useSound — Web Audio API synthesized sound engine
   Zero dependencies. Works offline. No audio files needed.
   ───────────────────────────────────────────────────────────── */

type OscType = OscillatorType;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return new Ctor();
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscType = "sine",
  volume = 0.4,
  startAt = 0
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  const t = ctx.currentTime + startAt;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}

function sweep(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  duration: number,
  type: OscType = "sine",
  volume = 0.4,
  startAt = 0
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  const t = ctx.currentTime + startAt;
  osc.frequency.setValueAtTime(freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}

function noise(ctx: AudioContext, duration: number, volume = 0.2, startAt = 0) {
  const bufSize = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime + startAt);
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(ctx.currentTime + startAt);
}

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const { selectedAudioPack } = usePlayerStats();

  const pack = getAudioPackById(selectedAudioPack);
  const waveType = pack.waveType;
  const pitchMult = pack.pitchMultiplier;

  const getAudioCtx = useCallback((): AudioContext | null => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = getCtx();
    }
    if (ctxRef.current?.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // ── XO cell placement pop
  const playPop = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    sweep(ctx, 500 * pitchMult, 180 * pitchMult, 0.12, waveType, 0.35);
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Timer tick (metronome click)
  const playTick = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    tone(ctx, 880 * pitchMult, 0.06, waveType, 0.15);
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Timer warning (urgent beep when low time)
  const playTimerWarning = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    tone(ctx, 1200 * pitchMult, 0.08, waveType, 0.25);
    tone(ctx, 900 * pitchMult, 0.08, waveType, 0.15, 0.12);
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Rage tap — satisfying tap
  const playTap = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    noise(ctx, 0.04, 0.25);
    tone(ctx, 300 * pitchMult, 0.06, waveType, 0.2);
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Countdown beep (different pitch per number)
  const playCountdown = useCallback(
    (num: number) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      if (num === 0) {
        // GO! — triumphant
        tone(ctx, 1047 * pitchMult, 0.15, waveType, 0.5);
        tone(ctx, 1319 * pitchMult, 0.15, waveType, 0.4, 0.15);
      } else {
        tone(ctx, (440 + num * 100) * pitchMult, 0.12, waveType, 0.3);
      }
    },
    [getAudioCtx, waveType, pitchMult]
  );

  // ── Winner fanfare — ascending arpeggio
  const playWin = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const notes = [523, 659, 784, 1047, 1319]; // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => {
      tone(ctx, freq * pitchMult, 0.25, waveType, 0.45, i * 0.1);
    });
    // Noise burst at start
    noise(ctx, 0.05, 0.3);
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Draw / lose — descending sad
  const playLose = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const notes = [392, 349, 294, 262];
    notes.forEach((freq, i) => {
      tone(ctx, freq * pitchMult, 0.2, waveType === "sine" ? "sine" : "sawtooth", 0.3, i * 0.15);
    });
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Emote sent — boing / funny
  const playEmote = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    sweep(ctx, 150 * pitchMult, 700 * pitchMult, 0.15, waveType, 0.5);
    sweep(ctx, 700 * pitchMult, 350 * pitchMult, 0.15, waveType, 0.4, 0.15);
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Coin earned
  const playCoin = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    tone(ctx, 1047 * pitchMult, 0.08, waveType, 0.35);
    tone(ctx, 1319 * pitchMult, 0.12, waveType, 0.4, 0.08);
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Shop purchase
  const playPurchase = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f * pitchMult, 0.15, waveType, 0.4, i * 0.08));
  }, [getAudioCtx, waveType, pitchMult]);

  // ── Error / can't afford
  const playError = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    tone(ctx, 200 * pitchMult, 0.2, waveType === "sine" ? "sine" : "sawtooth", 0.4);
    tone(ctx, 180 * pitchMult, 0.2, waveType === "sine" ? "sine" : "sawtooth", 0.35, 0.1);
  }, [getAudioCtx, waveType, pitchMult]);

  return {
    playPop,
    playTick,
    playTimerWarning,
    playTap,
    playCountdown,
    playWin,
    playLose,
    playEmote,
    playCoin,
    playPurchase,
    playError,
  };
}

