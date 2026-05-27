"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useSound } from "@/hooks/useSound";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { getAvatarById, getEmotePackById, getArenaThemeById } from "@/lib/gameStore";

/* ─── Constants ─── */
const GAME_DURATION = 15;
const BASE_REWARD = 100;
const TAP_FORCE = 2;
const MAX_POS = 100;

type GamePhase = "idle" | "countdown" | "playing" | "won";
type Winner = 1 | 2 | null;

/* ─── Emote system ─── */
const EMOTES = ["😂", "😡", "💀", "🤡"];

interface FloatingEmote {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotated: boolean;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
}

/* ─── Ripple layer ─── */
function RippleLayer({ ripples }: { ripples: Ripple[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {ripples.map((r) => (
        <div
          key={r.id}
          className="absolute rounded-full"
          style={{
            left: r.x,
            top: r.y,
            width: 0,
            height: 0,
            transform: "translate(-50%,-50%)",
            background: r.color,
            opacity: 0.6,
            animation: "ripple-out 0.5s ease-out forwards",
          }}
        />
      ))}
      <style>{`
        @keyframes ripple-out {
          0%   { width: 0;    height: 0;    opacity: 0.6; }
          100% { width: 130px; height: 130px; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ─── Floating emotes layer ─── */
function FloatingEmoteLayer({ emotes }: { emotes: FloatingEmote[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {emotes.map((e) => (
        <div
          key={e.id}
          className="absolute text-5xl select-none animate-emote-float"
          style={{
            left: e.x,
            top: e.y,
            transform: e.rotated ? "rotate(180deg)" : "none",
          }}
        >
          {e.emoji}
        </div>
      ))}
    </div>
  );
}

/* ─── Tug-of-war bar ─── */
function TugBar({ position }: { position: number }) {
  const clamped = Math.max(0, Math.min(MAX_POS, position));
  const p1Color = "#00f3ff";
  const p2Color = "#ff00f0";

  return (
    <div className="relative w-full h-8 rounded-full overflow-hidden bg-[#1e1e40] border border-[#2a2a50]">
      <div className="absolute left-0 top-0 bottom-0 rounded-l-full transition-all duration-75"
        style={{ width: `${clamped}%`, background: `linear-gradient(90deg, ${p1Color}aa, ${p1Color}33)` }} />
      <div className="absolute right-0 top-0 bottom-0 rounded-r-full transition-all duration-75"
        style={{ width: `${MAX_POS - clamped}%`, background: `linear-gradient(270deg, ${p2Color}aa, ${p2Color}33)` }} />
      {/* Knob */}
      <div className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-white z-10 transition-all duration-75"
        style={{
          left: `calc(${clamped}% - 14px)`,
          background: clamped < 48 ? p2Color : clamped > 52 ? p1Color : "#ffffff",
          boxShadow: `0 0 14px ${clamped < 48 ? p2Color : clamped > 52 ? p1Color : "#ffffff"}`,
        }} />
      {/* Center line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
    </div>
  );
}

/* ─── Double or Nothing modal ─── */
function DoubleOrNothingModal({
  currentStake, doubledStake, onAccept, onDecline,
}: {
  currentStake: number; doubledStake: number; onAccept: () => void; onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-lg" />
      <div className="relative w-full max-w-sm glass-card rounded-3xl border border-[#ffea0044] p-7 text-center animate-pop-in"
        style={{ boxShadow: "0 0 60px #ffea0022" }}>
        <div className="text-6xl mb-3 animate-double-flash">💰</div>
        <h2 className="text-3xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "#ffea00", textShadow: "0 0 20px #ffea00" }}>
          Double or Nothing!
        </h2>
        <p className="text-gray-400 text-sm mt-2">Winner takes double the coins!</p>
        <div className="grid grid-cols-2 gap-3 my-6">
          <div className="glass-card rounded-xl p-3 border border-[#1e1e40]">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Current</p>
            <p className="text-[#ffea00] font-black text-xl mt-1">🪙 {currentStake}</p>
          </div>
          <div className="glass-card rounded-xl p-3 border border-[#ffea0044]">
            <p className="text-[10px] text-[#ffea00] uppercase tracking-widest font-bold">Next Winner</p>
            <p className="text-[#ffea00] font-black text-xl mt-1 animate-double-flash">🪙 {doubledStake}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button id="rage-double-accept"
            className="flex-1 py-3 rounded-xl font-black uppercase tracking-wider text-sm btn-press text-[#06060f]"
            style={{ background: "linear-gradient(135deg, #ffea00, #ff6b00)", boxShadow: "0 0 20px #ffea0055" }}
            onClick={onAccept}>🔥 DOUBLE IT</button>
          <button id="rage-double-decline"
            className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm btn-press border border-[#1e1e40] text-gray-400"
            onClick={onDecline}>Normal</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Winner modal ─── */
interface WinnerModalProps {
  winner: Winner;
  reward: number;
  isEscalated: boolean;
  onRematch: () => void;
  onHome: () => void;
  onShare: () => void;
  gameMode?: "local" | "online" | "bot";
}

function WinnerModal({
  winner, reward, isEscalated, onRematch, onHome, onShare, gameMode
}: WinnerModalProps) {
  const color = winner === 1 ? "#00f3ff" : "#ff00f0";

  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 300]);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-lg" />
      <div className="relative w-full max-w-sm glass-card rounded-3xl p-8 text-center border animate-winner-appear"
        style={{ borderColor: `${color}44`, boxShadow: `0 0 60px ${color}33` }}>
        <div className="absolute inset-0 rounded-3xl opacity-8 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${color}22, transparent 70%)` }} />
        <div className="text-7xl mb-4">🏆</div>
        <h2 className="text-4xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color, textShadow: `0 0 20px ${color}` }}>
          {gameMode === "bot" ? (winner === 1 ? "YOU" : "BOT") : `Player ${winner}`}
        </h2>
        <p className="text-gray-300 text-xl font-bold mt-1">
          {gameMode === "bot" ? (winner === 1 ? "DESTROYED IT!" : "BEAT YOU!") : "DESTROYED IT!"}
        </p>
        {(gameMode !== "bot" || winner === 1) ? (
          <div className="flex items-center justify-center gap-2 my-5 p-3 rounded-xl bg-[#ffea0015] border border-[#ffea0033]">
            <span className="text-2xl">🪙</span>
            <div>
              <span className="text-[#ffea00] text-2xl font-black coin-glow">+{reward}</span>
              {isEscalated && <span className="ml-2 text-xs text-[#ff6600] font-bold">🔥 ESCALATED!</span>}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 my-4">No coins awarded. Better luck next time!</p>
        )}

        <div className="flex flex-col gap-3">
          {/* Share score scorecard button */}
          <button id="rage-share-btn"
            className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-sm btn-press bg-gradient-to-r from-[#ffea00] to-[#ff6b00] text-black shadow-md"
            onClick={onShare}>
            📢 Share Scorecard
          </button>
          
          <div className="flex gap-3">
            <button id="rage-rematch-btn"
              className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm btn-press border border-[#00f3ff44] text-[#00f3ff] hover:bg-[#00f3ff15] transition-all"
              onClick={onRematch}>🔄 Rematch</button>
            <button id="rage-home-btn"
              className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm btn-press bg-[#ff00f022] border border-[#ff00f044] text-[#ff00f0]"
              onClick={onHome}>🏠 Hub</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN INTERNAL CLIENT COMPONENT
══════════════════════════════════════════════ */
function RageTapInner() {
  const { addCoins, mounted, selectedAvatar, selectedEmotePack, selectedArenaTheme } = usePlayerStats();
  const { playTap, playCountdown, playWin, playLose, playTimerWarning, playEmote } = useSound();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");

  // Online Multiplayer Socket state
  const { connected, stats, findMatch, leaveMatch, emitAction, joinPrivateRoom, socket } = useSocket();
  const [gameMode, setGameMode] = useState<"local" | "online" | "bot">("local");
  const [isSearching, setIsSearching] = useState(false);
  const [myRole, setMyRole] = useState<Winner>(null); // 1 = P1 (Bottom), 2 = P2 (Top)
  const [opponentProfile, setOpponentProfile] = useState<{ name: string; avatarEmoji: string; avatarGlowColor: string } | null>(null);

  // Private Friends Lobbies States
  const [isPrivateLobby, setIsPrivateLobby] = useState(false);
  const [privateRoomCode, setPrivateRoomCode] = useState("");
  const [privateLobbyStatus, setPrivateLobbyStatus] = useState<"idle" | "waiting" | "ready">("idle");

  const currentAvatar = mounted ? getAvatarById(selectedAvatar) : { emoji: "🎮", glowColor: "#00f3ff", name: "Player" };

  const emotePack = getEmotePackById(selectedEmotePack);
  const activeEmotes = emotePack.emotes;
  const arena = getArenaThemeById(selectedArenaTheme);

  // WebRTC Live Voice Chat hook
  const { voiceActive, peerState, toggleVoiceChat } = useWebRTC({
    socket,
    connected,
    gameMode,
    myRole,
    emitAction
  });

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [tugPos, setTugPos] = useState(50);
  const [p1Taps, setP1Taps] = useState(0);
  const [p2Taps, setP2Taps] = useState(0);
  const [winner, setWinner] = useState<Winner>(null);
  const [p1Ripples, setP1Ripples] = useState<Ripple[]>([]);
  const [p2Ripples, setP2Ripples] = useState<Ripple[]>([]);
  const [rewardGiven, setRewardGiven] = useState(false);
  const [currentStake, setCurrentStake] = useState(BASE_REWARD);
  const [showDoubleModal, setShowDoubleModal] = useState(false);
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);

  // High frequency taps batch accumulator
  const tapsAccumulator = useRef(0);

  // Shake when <= 5s
  const [shaking, setShaking] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rippleId = useRef(0);
  const emoteId = useRef(0);
  const tugRef = useRef(50); // Sync ref for async callbacks

  const endGame = useCallback((pos: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const w: Winner = pos >= MAX_POS ? 1 : pos <= 0 ? 2 : pos > 50 ? 1 : 2;
    setWinner(w);
    setPhase("won");
    if (w === 1) playWin(); else playLose();
    setShaking(false);
  }, [playWin, playLose]);

  // Parse invite code link parameters
  useEffect(() => {
    if (roomParam && mounted && connected) {
      setGameMode("online");
      setIsSearching(false);
      setIsPrivateLobby(true);
      setPrivateRoomCode(roomParam.toUpperCase());
      setPrivateLobbyStatus("ready");
      joinPrivateRoom("join", "rage-tap", roomParam, {
        name: "CLASH PRO",
        avatarEmoji: currentAvatar.emoji,
        avatarGlowColor: currentAvatar.glowColor
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam, mounted, connected]);

  // Coin reward on win (Only local/bot mode — Online verified with server tokens)
  useEffect(() => {
    if (gameMode === "online") return;
    if (phase === "won" && winner && mounted && !rewardGiven) {
      if (gameMode === "bot") {
        if (winner === 1) {
          addCoins(currentStake);
        }
      } else {
        addCoins(currentStake);
      }
      setRewardGiven(true);
    }
  }, [phase, winner, mounted, addCoins, currentStake, rewardGiven, gameMode]);

  // Bot Tapping Simulator Loop
  useEffect(() => {
    if (gameMode !== "bot" || phase !== "playing") return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const simulateTap = () => {
      setP2Taps((t) => t + 1);

      // Trigger ripple effect for Bot (P2) in top half
      const rect = document.getElementById("p2-zone")?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width * (0.3 + Math.random() * 0.4) : 200;
      const cy = rect ? rect.top + rect.height * (0.3 + Math.random() * 0.4) : 150;
      const id = rippleId.current++;

      setP2Ripples((prev) => [
        ...prev.slice(-8),
        { id, x: cx - (rect?.left ?? 0), y: cy - (rect?.top ?? 0), color: "#ff00f0" }
      ]);
      setTimeout(() => setP2Ripples((prev) => prev.filter((r) => r.id !== id)), 600);

      playTap();

      setTugPos((prev) => {
        const next = Math.max(0, prev - TAP_FORCE);
        tugRef.current = next;
        if (next <= 0) {
          endGame(next);
        }
        return next;
      });

      // Randomized speed (5 to 7 taps per second -> 150ms to 250ms interval)
      const randomInterval = Math.floor(Math.random() * (250 - 150 + 1)) + 150;
      timeoutId = setTimeout(simulateTap, randomInterval);
    };

    const initialDelay = Math.floor(Math.random() * (250 - 150 + 1)) + 150;
    timeoutId = setTimeout(simulateTap, initialDelay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [gameMode, phase, endGame, playTap]);

  // Request Wake Lock during countdown/gameplay, release afterwards
  useEffect(() => {
    if (phase === "playing" || phase === "countdown") {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [phase, requestWakeLock, releaseWakeLock]);

  // Countdown sequence with sounds (Only local)
  useEffect(() => {
    if (gameMode === "online") return;
    if (phase !== "countdown") return;
    if (countdown < 0) { setPhase("playing"); return; }
    playCountdown(countdown);
    if (countdown === 0) {
      const t = setTimeout(() => setPhase("playing"), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, playCountdown, gameMode]);

  // Game timer with warning sounds (Only local)
  useEffect(() => {
    if (gameMode === "online") return;
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 5 && next > 0) {
          playTimerWarning();
          setShaking(true);
        }
        if (next <= 0) {
          endGame(tugRef.current);
          setShaking(false);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, endGame, playTimerWarning, gameMode]);

  // High frequency 100ms batched taps client transmitter
  useEffect(() => {
    if (phase !== "playing" || gameMode !== "online") return;

    const interval = setInterval(() => {
      if (tapsAccumulator.current > 0) {
        emitAction("submit_taps", { tapCount: tapsAccumulator.current });
        tapsAccumulator.current = 0;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase, gameMode]);

  // Socket online room listeners
  useEffect(() => {
    if (!socket || gameMode !== "online") return;

    socket.on("match_found", (data: { roomId: string, opponent: any, role: Winner, stake: number }) => {
      setIsSearching(false);
      setIsPrivateLobby(false);
      setPrivateLobbyStatus("ready");
      setMyRole(data.role);
      setOpponentProfile(data.opponent);
      setCurrentStake(data.stake);
      setCountdown(3);
      setTimeLeft(GAME_DURATION);
      setTugPos(50);
      tugRef.current = 50;
      setP1Taps(0);
      setP2Taps(0);
      setWinner(null);
      setP1Ripples([]);
      setP2Ripples([]);
      setRewardGiven(false);
      setShaking(false);
      setShowDoubleModal(false);
      setFloatingEmotes([]);
      setPhase("countdown");
    });

    socket.on("countdown_step", (data: { countdown: number }) => {
      setCountdown(data.countdown);
      if (data.countdown >= 0) {
        playCountdown(data.countdown);
      }
    });

    socket.on("game_start", () => {
      setPhase("playing");
    });

    socket.on("state_sync", (data: { position: number, p1Taps: number, p2Taps: number }) => {
      setTugPos(data.position);
      tugRef.current = data.position;
      setP1Taps(data.p1Taps);
      setP2Taps(data.p2Taps);
      playTap();
    });

    socket.on("timer_sync", (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
      if (data.timeLeft <= 5 && data.timeLeft > 0) {
        playTimerWarning();
        setShaking(true);
      } else {
        setShaking(false);
      }
    });

    socket.on("opponent_emote", (data: { emoji: string, senderSocketId: string }) => {
      playEmote();
      const id = emoteId.current++;
      // Opponent emote always floats on the other zone of the client
      const x = 40 + Math.random() * 120;
      const y = window.innerHeight * 0.25 + Math.random() * 60;
      setFloatingEmotes((prev) => [...prev.slice(-6), { id, emoji: data.emoji, x, y, rotated: false }]);
      setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 1400);
    });

    socket.on("game_over", (data: { winner: Winner, reward: number, token?: string }) => {
      setWinner(data.winner);
      setPhase("won");
      setShaking(false);

      if (data.winner === myRole) {
        playWin();
        if (data.token && !rewardGiven) {
          addCoins(data.reward);
          setRewardGiven(true);
        }
      } else {
        playLose();
      }
    });

    socket.on("opponent_left", (data: { winner: Winner, reward: number, token: string }) => {
      setWinner(data.winner);
      setPhase("won");
      setShaking(false);

      if (data.winner === myRole) {
        playWin();
        if (data.token && !rewardGiven) {
          addCoins(data.reward);
          setRewardGiven(true);
        }
      }
    });

    socket.on("private_room_status", (data: { action: string, roomCode?: string, status: string, message?: string }) => {
      if (data.status === "waiting" && data.roomCode) {
        setPrivateRoomCode(data.roomCode);
        setPrivateLobbyStatus("waiting");
      } else if (data.status === "error") {
        setIsSearching(false);
        setIsPrivateLobby(false);
        setPrivateLobbyStatus("idle");
        alert(data.message || "Failed to join private lobby!");
      }
    });

    return () => {
      socket.off("match_found");
      socket.off("countdown_step");
      socket.off("game_start");
      socket.off("state_sync");
      socket.off("timer_sync");
      socket.off("opponent_emote");
      socket.off("game_over");
      socket.off("opponent_left");
      socket.off("private_room_status");
    };
  }, [socket, gameMode, myRole, rewardGiven, addCoins, playTap, playCountdown, playTimerWarning, playEmote, playWin, playLose]);

  const startGame = (stake = BASE_REWARD) => {
    setCountdown(3);
    setTimeLeft(GAME_DURATION);
    tugRef.current = 50;
    setTugPos(50);
    setP1Taps(0);
    setP2Taps(0);
    setWinner(null);
    setP1Ripples([]);
    setP2Ripples([]);
    setRewardGiven(false);
    setCurrentStake(stake);
    setShaking(false);
    setShowDoubleModal(false);
    setFloatingEmotes([]);
    setPhase("countdown");
  };

  const addRipple = (
    setter: React.Dispatch<React.SetStateAction<Ripple[]>>,
    e: React.TouchEvent | React.MouseEvent,
    color: string
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0]?.clientX ?? rect.left + rect.width / 2 : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0]?.clientY ?? rect.top + rect.height / 2 : (e as React.MouseEvent).clientY;
    const id = rippleId.current++;
    setter((prev) => [...prev.slice(-8), { id, x: cx - rect.left, y: cy - rect.top, color }]);
    setTimeout(() => setter((prev) => prev.filter((r) => r.id !== id)), 600);
  };

  // P1 tap (BOTTOM — pushes right → increases pos)
  const handleP1Tap = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== "playing") return;
    if (navigator.vibrate) navigator.vibrate([30]);
    playTap();

    if (gameMode === "online") {
      if (myRole !== 1) return; // Can only tap bottom if we are Player 1
      tapsAccumulator.current += 1;
      setP1Taps((t) => t + 1);
      addRipple(setP1Ripples, e, "#00f3ff");
      return;
    }

    setP1Taps((t) => t + 1);
    addRipple(setP1Ripples, e, "#00f3ff");
    setTugPos((prev) => {
      const next = Math.min(MAX_POS, prev + TAP_FORCE);
      tugRef.current = next;
      if (next >= MAX_POS) endGame(next);
      return next;
    });
  }, [phase, endGame, playTap, gameMode, myRole]);

  // P2 tap (TOP — pushes left → decreases pos)
  const handleP2Tap = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== "playing") return;
    if (navigator.vibrate) navigator.vibrate([30]);
    playTap();

    if (gameMode === "online") {
      if (myRole !== 2) return; // Can only tap top if we are Player 2
      tapsAccumulator.current += 1;
      setP2Taps((t) => t + 1);
      addRipple(setP2Ripples, e, "#ff00f0");
      return;
    }

    setP2Taps((t) => t + 1);
    addRipple(setP2Ripples, e, "#ff00f0");
    setTugPos((prev) => {
      const next = Math.max(0, prev - TAP_FORCE);
      tugRef.current = next;
      if (next <= 0) endGame(next);
      return next;
    });
  }, [phase, endGame, playTap, gameMode, myRole]);

  // Emote send — shows on OPPONENT's zone
  const handleP1Emote = (emoji: string) => {
    playEmote();
    if (navigator.vibrate) navigator.vibrate([30]);

    if (gameMode === "online") {
      emitAction("send_emote", { emoji });
    }

    const id = emoteId.current++;
    // Local P1 sends → appears in top zone (P2 zone), rotated
    const x = 40 + Math.random() * 120;
    const y = window.innerHeight * 0.15 + Math.random() * 60;
    setFloatingEmotes((prev) => [...prev.slice(-6), { id, emoji, x, y, rotated: true }]);
    setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 1400);
  };

  const handleP2Emote = (emoji: string) => {
    playEmote();
    if (navigator.vibrate) navigator.vibrate([30]);

    if (gameMode === "online") {
      emitAction("send_emote", { emoji });
    }

    const id = emoteId.current++;
    // Local P2 sends → appears in bottom zone (P1 zone), not rotated
    const x = 40 + Math.random() * 120;
    const y = window.innerHeight * 0.65 + Math.random() * 60;
    setFloatingEmotes((prev) => [...prev.slice(-6), { id, emoji, x, y, rotated: false }]);
    setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 1400);
  };

  const startOnlineMatchmaking = () => {
    setGameMode("online");
    setIsSearching(true);
    setIsPrivateLobby(false);
    setRewardGiven(false);
    setMyRole(null);
    setOpponentProfile(null);

    findMatch("rage-tap", {
      name: "CLASH PRO",
      avatarEmoji: currentAvatar.emoji,
      avatarGlowColor: currentAvatar.glowColor
    });
  };

  // Launch private lobby loop
  const startPrivateFriendLobby = () => {
    setGameMode("online");
    setIsSearching(false);
    setIsPrivateLobby(true);
    setPrivateLobbyStatus("waiting");
    setRewardGiven(false);
    setMyRole(null);
    setOpponentProfile(null);

    joinPrivateRoom("create", "rage-tap", "", {
      name: "CLASH PRO",
      avatarEmoji: currentAvatar.emoji,
      avatarGlowColor: currentAvatar.glowColor
    });
  };

  const joinPrivateWithCode = (code: string) => {
    if (!code) return;
    setGameMode("online");
    setIsSearching(false);
    setIsPrivateLobby(true);
    setPrivateLobbyStatus("ready");
    setRewardGiven(false);
    setMyRole(null);
    setOpponentProfile(null);

    joinPrivateRoom("join", "rage-tap", code.toUpperCase(), {
      name: "CLASH PRO",
      avatarEmoji: currentAvatar.emoji,
      avatarGlowColor: currentAvatar.glowColor
    });
  };

  const cancelMatchmaking = () => {
    leaveMatch();
    setIsSearching(false);
    setIsPrivateLobby(false);
    setPrivateLobbyStatus("idle");
    setGameMode("local");
  };

  // Rematch with Double or Nothing
  const handleRematchClick = () => {
    if (gameMode === "online") {
      startOnlineMatchmaking();
      return;
    }
    setShowDoubleModal(true);
  };

  const handleDoubleAccept = () => startGame(currentStake * 2);
  const handleDoubleDecline = () => startGame(BASE_REWARD);

  // Render glowing HTML Canvas 2D score card and share natively
  const handleShareScorecard = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw radial glowing Cyberpunk Dark background
    const grad = ctx.createRadialGradient(300, 300, 50, 300, 300, 450);
    grad.addColorStop(0, "#13132b");
    grad.addColorStop(1, "#06060f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 600);

    // Neon Pink Grid overlay
    ctx.strokeStyle = "rgba(255, 0, 240, 0.04)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < 600; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y < 600; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(600, y);
      ctx.stroke();
    }

    // Neon Cyan ambient side glows
    ctx.fillStyle = "rgba(0, 243, 255, 0.04)";
    ctx.beginPath();
    ctx.arc(0, 300, 160, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 0, 240, 0.04)";
    ctx.beginPath();
    ctx.arc(600, 300, 160, 0, Math.PI * 2);
    ctx.fill();

    // 2. Mini Clash Neon Header
    ctx.fillStyle = "#ff00f0";
    ctx.font = "900 48px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MINI CLASH", 300, 90);

    ctx.fillStyle = "#ffea00";
    ctx.font = "bold 16px Rajdhani, sans-serif";
    ctx.fillText("⚡ MULTIPLAYER ARCADE SOCIAL HUB ⚡", 300, 125);

    // 3. Central card border
    ctx.fillStyle = "rgba(13, 13, 26, 0.9)";
    ctx.strokeStyle = "rgba(255, 0, 240, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(80, 160, 440, 340, 24);
    ctx.fill();
    ctx.stroke();

    // Game Title details
    ctx.fillStyle = "#00f3ff";
    ctx.font = "900 24px Orbitron, sans-serif";
    ctx.fillText("RAGE TAP BATTLE RESULT", 300, 215);

    // Avatars representation
    ctx.font = "64px sans-serif";
    const myEmoji = currentAvatar.emoji;
    const rivalEmoji = opponentProfile?.avatarEmoji || "🤖";
    ctx.fillText(myEmoji, 200, 300);
    ctx.fillStyle = "#e8e8ff";
    ctx.font = "bold 20px Orbitron, sans-serif";
    ctx.fillText("VS", 300, 280);
    ctx.font = "64px sans-serif";
    ctx.fillText(rivalEmoji, 400, 300);

    // Victory outcomes
    const weWon = winner === myRole;
    ctx.font = "900 36px Orbitron, sans-serif";
    ctx.fillStyle = weWon ? "#00ff88" : "#ff4444";
    ctx.fillText(weWon ? "YOU WON! 🏆" : "RIVAL WON! 💀", 300, 390);

    // Bounty Coins
    if (winner === myRole) {
      ctx.fillStyle = "#ffea00";
      ctx.font = "bold 22px Rajdhani, sans-serif";
      ctx.fillText(`+🪙 ${currentStake} COINS ADDED`, 300, 435);
    }

    // Footer Watermark
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "bold 13px Rajdhani, sans-serif";
    ctx.fillText("Play with your friends instantly at: miniclash.com", 300, 470);

    // Convert Canvas to Blob and engage native Web Share API
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "mini_clash_scorecard.png", { type: "image/png" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: "Mini Clash Scorecard",
            text: "I just won in Mini Clash Rage Tap! Battle me online with this invite link!",
            files: [file],
          });
        } catch (err) {
          triggerDownload(canvas);
        }
      } else {
        triggerDownload(canvas);
      }
    });
  };

  const triggerDownload = (canvas: HTMLCanvasElement) => {
    const link = document.createElement("a");
    link.download = "mini_clash_scorecard.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const pLink = typeof window !== "undefined" ? `${window.location.origin}/games/rage-tap?room=${privateRoomCode}` : "";

  return (
    <div className={`relative min-h-dvh max-w-md mx-auto flex flex-col overflow-hidden bg-[#06060f] ${shaking ? "animate-screen-shake" : ""}`}
      style={{
        backgroundImage: `
          linear-gradient(${arena.bgGridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${arena.bgGridColor} 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px"
      }}>
      <FloatingEmoteLayer emotes={floatingEmotes} />

      {/* ══ IDLE / SELECTION ══ */}
      {phase === "idle" && !isSearching && (!isPrivateLobby || privateLobbyStatus === "idle") && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 animate-slide-up">
          <Link href="/" className="self-start glass-card rounded-xl p-2.5 border border-[#1e1e40] hover:border-current transition-colors btn-press" style={{ color: arena.colorSecondary }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div className="text-center">
            <div className="text-8xl mb-4 animate-float">👊</div>
            <h1 className="text-4xl font-black uppercase leading-none" style={{ fontFamily: "var(--font-display)", color: arena.colorSecondary, textShadow: `0 0 15px ${arena.colorSecondary}` }}>Rage Tap</h1>
            <h2 className="text-2xl font-black uppercase leading-none mt-1" style={{ fontFamily: "var(--font-display)", color: arena.colorPrimary, textShadow: `0 0 15px ${arena.colorPrimary}` }}>Battle</h2>
            <p className="text-gray-400 mt-3 text-sm leading-relaxed">
              Tug-of-war button smashing. Out-tap your rival in <span className="text-[#ffea00] font-bold">15 seconds</span>!
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button id="rage-start-online-btn"
              className="w-full py-4.5 rounded-2xl font-black text-xl uppercase tracking-widest text-[#06060f] btn-press"
              style={{ background: `linear-gradient(135deg, ${arena.colorSecondary}, ${arena.colorPrimary})`, boxShadow: `0 0 30px ${arena.colorSecondary}55` }}
              onClick={startOnlineMatchmaking}>
              🌐 MATCHMAKING (RANDOM)
            </button>
            
            <button id="rage-private-lobby-btn"
              className="w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest text-[#e8e8ff] glass-card border border-[#ffea0033] hover:bg-[#ffea0008] transition-all btn-press"
              style={{ borderColor: `${arena.colorPrimary}33` }}
              onClick={startPrivateFriendLobby}>
              👥 PLAY WITH FRIEND (PRIVATE)
            </button>

            <button id="rage-start-bot-btn"
              className="w-full py-4.5 rounded-2xl font-black text-xl uppercase tracking-widest text-[#06060f] btn-press"
              style={{ background: `linear-gradient(135deg, ${arena.colorSecondary}, ${arena.colorPrimary})`, boxShadow: `0 0 30px ${arena.colorSecondary}55` }}
              onClick={() => { setGameMode("bot"); startGame(); }}>
              🤖 PLAY VS BOT (1P)
            </button>

            <button id="rage-start-local-btn"
              className="w-full py-4 rounded-2xl font-bold text-lg uppercase tracking-widest text-gray-400 glass-card border border-[#1e1e40] hover:border-current transition-all btn-press"
              style={{ borderColor: `${arena.colorSecondary}33`, color: arena.colorSecondary }}
              onClick={() => { setGameMode("local"); startGame(); }}>
              📱 PLAY LOCAL (2P)
            </button>

            {/* Private Code join input form */}
            <div className="mt-4 glass-card rounded-2xl border border-[#1e1e40] p-4 text-center" style={{ borderColor: `${arena.colorPrimary}33` }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Have a Friend's Invite Code?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ENTER CODE"
                  maxLength={4}
                  className="flex-1 rounded-xl bg-black/60 border border-[#1e1e40] text-center text-lg font-black uppercase text-[#ffea00] placeholder-gray-700 outline-none focus:border-[#ffea0055]"
                  style={{ borderColor: `${arena.colorPrimary}33`, color: arena.colorSecondary }}
                  id="rage-code-input-box"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById("rage-code-input-box") as HTMLInputElement;
                    joinPrivateWithCode(input?.value);
                  }}
                  className="px-4 py-2.5 rounded-xl font-bold uppercase text-xs btn-press text-[#06060f]"
                  style={{ background: `linear-gradient(135deg, ${arena.colorPrimary}, ${arena.colorSecondary})` }}
                >
                  JOIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOBBY / MATCHMAKING QUEUE ══ */}
      {phase === "idle" && isSearching && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full border-4 border-[#1e1e40] animate-spin mx-auto mb-4" style={{ borderTopColor: arena.colorSecondary }} />
            <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: arena.colorSecondary, textShadow: `0 0 10px ${arena.colorSecondary}` }}>LOBBY QUEUE</h2>
            <p className="text-gray-400 mt-2 text-sm max-w-xs mx-auto">
              Matchmaking with tap speedsters...
            </p>
            <p className="text-xs font-bold mt-4 animate-pulse uppercase tracking-wider" style={{ color: arena.colorPrimary }}>
              Waiting: {stats.waitingPlayers} · Connected: {stats.onlinePlayers}
            </p>
          </div>
          <button
            className="w-full max-w-xs py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm btn-press border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
            onClick={cancelMatchmaking}
          >
            ❌ CANCEL
          </button>
        </div>
      )}

      {/* ── Private invite Lobby waiting room overlay ── */}
      {phase === "idle" && isPrivateLobby && privateLobbyStatus === "waiting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up px-3 text-center">
          <div className="glass-card rounded-3xl border border-[#ffea0033] p-7 w-full max-w-xs" style={{ borderColor: `${arena.colorPrimary}33` }}>
            <span className="text-6xl mb-3 block animate-float">👥</span>
            <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: arena.colorPrimary, textShadow: `0 0 10px ${arena.colorPrimary}` }}>LOBBY CODE</h2>
            <div className="my-4 p-4 rounded-xl bg-black/60 border border-[#ffea0033] text-center select-all" style={{ borderColor: `${arena.colorPrimary}33` }}>
              <span className="text-4xl font-black tracking-widest" style={{ fontFamily: "var(--font-display)", color: arena.colorSecondary }}>
                {privateRoomCode}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-snug">Share this code or the quick invite link below with a friend via WhatsApp to start the match!</p>
            
            <div className="flex flex-col gap-2.5 mt-5">
              {/* Copy invite code */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pLink);
                  alert("Invite link copied to clipboard!");
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold uppercase border border-[#00f3ff44] text-[#00f3ff] bg-[#00f3ff0a] btn-press"
                style={{ borderColor: `${arena.colorPrimary}44`, color: arena.colorPrimary }}
              >
                🔗 COPY INVITE LINK
              </button>
              {/* WhatsApp button */}
              <a
                href={`https://api.whatsapp.com/send?text=Battle%20me%20in%20Mini%20Clash!%20Click%20here%20to%20join%20my%20private%20lobby:%20${encodeURIComponent(pLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl text-xs font-black uppercase text-[#06060f] tracking-wider text-center btn-press flex items-center justify-center gap-1.5"
                style={{ backgroundColor: "#25d366" }}
              >
                💬 WHATSAPP SHARE
              </a>
            </div>
          </div>
          
          <button
            className="w-full max-w-xs py-3 rounded-xl font-bold uppercase tracking-wider text-xs btn-press border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
            onClick={cancelMatchmaking}
          >
            ❌ LEAVE LOBBY
          </button>
        </div>
      )}

      {/* ══ COUNTDOWN ══ */}
      {phase === "countdown" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-4">Get Ready...</p>
            <div className="text-[10rem] font-black leading-none animate-pop-in"
              style={{
                fontFamily: "var(--font-display)",
                color: countdown > 0 ? "#ff00f0" : "#00f3ff",
                textShadow: `0 0 60px ${countdown > 0 ? "#ff00f0" : "#00f3ff"}`,
              }}>
              {countdown === 0 ? "GO!" : countdown}
            </div>
          </div>
        </div>
      )}

      {/* ══ PLAYING ══ */}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col">

          {/* WebRTC Voice Chat Overlay */}
          {gameMode === "online" && (
            <div className="absolute top-16 left-4 right-4 z-20 flex items-center justify-between glass-card rounded-2xl border border-[#1e1e40] p-2.5 opacity-90">
              <div className="flex items-center gap-2">
                <span className="text-base">🎙️</span>
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-none">Voice Chat</p>
                  <p className={`text-[10px] font-bold leading-none mt-0.5 ${voiceActive ? "text-[#00ff88]" : "text-gray-400"}`}>
                    {voiceActive ? `ACTIVE · ${peerState.toUpperCase()}` : "MUTED"}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleVoiceChat}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all btn-press border ${
                  voiceActive 
                    ? "bg-[#ff004015] border-[#ff004044] text-[#ff0040]" 
                    : "bg-[#00ff8815] border-[#00ff8844] text-[#00ff88]"
                }`}
              >
                {voiceActive ? "MUTE" : "UNMUTE"}
              </button>
            </div>
          )}

          {/* Player 2 (Top Half) */}
          <div id="p2-zone"
            className={`relative flex-1 flex flex-col items-center justify-center overflow-hidden cursor-pointer select-none touch-manipulation ${
              (gameMode === "online" && myRole === 1) || gameMode === "bot" ? "pointer-events-none opacity-50" : ""
            }`}
            style={{ background: `linear-gradient(180deg, ${arena.colorSecondary}22 0%, #06060f 100%)` }}
            onTouchStart={handleP2Tap}
            onClick={handleP2Tap}>
            <RippleLayer ripples={p2Ripples} />

            {/* Emotes bar (Only if active or local) */}
            {(!isSearching && (gameMode === "local" || myRole === 2)) && (
              <div className="absolute bottom-3 left-3 z-20 flex gap-1.5 rotate-180">
                {activeEmotes.map((emoji) => (
                  <button key={emoji}
                    className="w-9 h-9 rounded-xl glass-card border border-[#ffffff11] flex items-center justify-center text-lg btn-press pointer-events-auto"
                    onTouchStart={(e) => { e.stopPropagation(); handleP2Emote(emoji); }}
                    onClick={(e) => { e.stopPropagation(); handleP2Emote(emoji); }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="rotate-180 flex flex-col items-center gap-3 pointer-events-none select-none">
              <div className="text-7xl font-black" style={{ fontFamily: "var(--font-display)", color: arena.colorSecondary, textShadow: `0 0 30px ${arena.colorSecondary}` }}>
                {p2Taps}
              </div>
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: arena.colorSecondary }}>
                {gameMode === "online" 
                  ? (myRole === 2 ? "👉 YOU (TAP! Taps synced)" : `RIVAL: ${opponentProfile?.name || "Player"}`)
                  : gameMode === "bot"
                  ? "🤖 SMART BOT"
                  : "Player 2 — TAP!"
                }
              </p>
              {!(gameMode === "online" && myRole === 1 || gameMode === "bot") && <div className="text-4xl animate-bounce">👇</div>}
            </div>

            {tugPos > 72 && (
              <div className="absolute inset-0 border-4 opacity-60 animate-pulse pointer-events-none" style={{ borderColor: arena.colorPrimary }} />
            )}
          </div>

          {/* CENTER HUD */}
          <div className="z-10 px-4 py-3 glass-panel border-y border-[#1e1e40] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-widest">Time</span>
              <span className="font-black text-2xl tabular-nums"
                style={{
                  fontFamily: "var(--font-display)",
                  color: timeLeft <= 5 ? "#ff0040" : "#ffea00",
                  textShadow: timeLeft <= 5 ? "0 0 15px #ff0040" : "0 0 10px #ffea00",
                  animation: timeLeft <= 5 ? "glow-pulse 0.4s ease-in-out infinite" : "none",
                }}>
                {timeLeft}s
              </span>
              <span className="text-xs text-gray-500 uppercase tracking-widest">Left</span>
            </div>
            <TugBar position={tugPos} />
            <div className="flex justify-between text-[10px] uppercase tracking-widest">
              <span className="font-bold" style={{ color: arena.colorSecondary }}>← P2</span>
              <span className="text-gray-600">Stake: 🪙 {currentStake}</span>
              <span className="font-bold" style={{ color: arena.colorPrimary }}>P1 →</span>
            </div>
          </div>

          {/* Player 1 (Bottom Half) */}
          <div id="p1-zone"
            className={`relative flex-1 flex flex-col items-center justify-center overflow-hidden cursor-pointer select-none touch-manipulation ${
              gameMode === "online" && myRole === 2 ? "pointer-events-none opacity-50" : ""
            }`}
            style={{ background: `linear-gradient(0deg, ${arena.colorPrimary}22 0%, #06060f 100%)` }}
            onTouchStart={handleP1Tap}
            onClick={handleP1Tap}>
            <RippleLayer ripples={p1Ripples} />

            {(!isSearching && (gameMode === "local" || myRole === 1)) && (
              <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
                {activeEmotes.map((emoji) => (
                  <button key={emoji}
                    className="w-9 h-9 rounded-xl glass-card border border-[#ffffff11] flex items-center justify-center text-lg btn-press pointer-events-auto"
                    onTouchStart={(e) => { e.stopPropagation(); handleP1Emote(emoji); }}
                    onClick={(e) => { e.stopPropagation(); handleP1Emote(emoji); }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col items-center gap-3 pointer-events-none select-none">
              {!(gameMode === "online" && myRole === 2 || gameMode === "bot") && <div className="text-4xl animate-bounce">👆</div>}
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: arena.colorPrimary }}>
                {gameMode === "online"
                  ? (myRole === 1 ? "👉 YOU (TAP! Taps synced)" : `RIVAL: ${opponentProfile?.name || "Player"}`)
                  : gameMode === "bot"
                  ? "👉 YOU (P1)"
                  : "Player 1 — TAP!"
                }
              </p>
              <div className="text-7xl font-black" style={{ fontFamily: "var(--font-display)", color: arena.colorPrimary, textShadow: `0 0 30px ${arena.colorPrimary}` }}>
                {p1Taps}
              </div>
            </div>

            {tugPos < 28 && (
              <div className="absolute inset-0 border-4 opacity-60 animate-pulse pointer-events-none" style={{ borderColor: arena.colorSecondary }} />
            )}
          </div>
        </div>
      )}

      {/* ══ WINNER MODAL ══ */}
      {phase === "won" && winner && !showDoubleModal && (
        <WinnerModal
          winner={winner}
          reward={currentStake}
          isEscalated={currentStake > BASE_REWARD}
          onRematch={handleRematchClick}
          onHome={() => { 
            if (gameMode === "online") leaveMatch();
            setPhase("idle"); 
            setGameMode("local");
            setIsPrivateLobby(false);
            setPrivateLobbyStatus("idle");
            setCurrentStake(BASE_REWARD); 
          }}
          onShare={handleShareScorecard}
          gameMode={gameMode}
        />
      )}

      {/* ══ DOUBLE OR NOTHING ══ */}
      {showDoubleModal && (
        <DoubleOrNothingModal
          currentStake={currentStake}
          doubledStake={currentStake * 2}
          onAccept={handleDoubleAccept}
          onDecline={handleDoubleDecline}
        />
      )}
    </div>
  );
}

export default function RageTapPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh max-w-md mx-auto bg-[#06060f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-[#ff00f0] border-[#1e1e40] rounded-full animate-spin"></div>
      </div>
    }>
      <RageTapInner />
    </Suspense>
  );
}
