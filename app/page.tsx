"use client";

import Link from "next/link";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useEffect, useRef, useState } from "react";
import { checkAndUpdateStreak, getAvatarById, StreakCheckResult } from "@/lib/gameStore";
import { useSound } from "@/hooks/useSound";
import { useSocket } from "@/hooks/useSocket";

/* ─── Animated coin counter ─── */
function CoinCounter({ coins, mounted }: { coins: number; mounted: boolean }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const target = coins;
    const start = display;
    const diff = target - start;
    if (diff === 0) return;
    const duration = 600;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins, mounted]);

  return (
    <span className="coin-glow font-bold text-xl tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
      {mounted ? display.toLocaleString() : "···"}
    </span>
  );
}

/* ─── Daily Streak Popup ─── */
function StreakPopup({
  result,
  onClaim,
}: {
  result: StreakCheckResult;
  onClaim: () => void;
}) {
  const { playCoin } = useSound();

  const handleClaim = () => {
    playCoin();
    if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
    onClaim();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" />
      <div className="relative w-full max-w-sm glass-card rounded-3xl border border-[#ffea0033] p-8 text-center animate-winner-appear"
        style={{ boxShadow: "0 0 60px #ffea0022, 0 0 120px #ffea0011" }}>

        <div className="absolute inset-0 rounded-3xl opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, #ffea00, transparent 70%)" }} />

        {/* Streak fire emoji */}
        <div className="text-7xl mb-2 animate-bounce">🔥</div>

        {/* Streak count */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {Array.from({ length: Math.min(result.newCount, 7) }).map((_, i) => (
            <div key={i} className={`w-2 h-8 rounded-full ${i < result.newCount ? "bg-[#ffea00]" : "bg-[#1e1e40]"}`}
              style={{ boxShadow: i < result.newCount ? "0 0 6px #ffea00" : "none" }} />
          ))}
          {result.newCount > 7 && <span className="text-[#ffea00] font-bold">+{result.newCount - 7}</span>}
        </div>

        <h2 className="text-3xl font-black uppercase mt-3"
          style={{ fontFamily: "var(--font-display)", color: "#ffea00", textShadow: "0 0 20px #ffea00" }}>
          Day {result.newCount} {result.isConsecutive ? "Streak!" : "– Welcome Back!"}
        </h2>

        {result.isConsecutive ? (
          <p className="text-gray-300 mt-2 text-sm">Keep it up! You&apos;re on fire 🔥</p>
        ) : (
          <p className="text-gray-400 mt-2 text-sm">Your streak reset. Start a new one!</p>
        )}

        {/* Coin reward */}
        <div className="flex items-center justify-center gap-2 my-5 p-4 rounded-2xl bg-[#ffea0015] border border-[#ffea0033]">
          <span className="text-3xl">🪙</span>
          <div>
            <p className="text-[#ffea00] text-3xl font-black coin-glow">+{result.coinsBonus}</p>
            <p className="text-gray-400 text-xs">Daily Login Bonus</p>
          </div>
        </div>

        <button
          id="streak-claim-btn"
          className="w-full py-4 rounded-2xl font-black text-xl uppercase tracking-widest text-[#06060f] btn-press"
          style={{ background: "linear-gradient(135deg, #ffea00, #ff6b00)", boxShadow: "0 0 30px #ffea0055" }}
          onClick={handleClaim}
        >
          🔥 CLAIM BONUS
        </button>
      </div>
    </div>
  );
}

/* ─── Game Card ─── */
interface GameCardProps {
  title: string;
  subtitle: string;
  reward: string;
  emoji: string;
  href: string;
  color: "cyan" | "pink";
  badge?: string;
  locked?: boolean;
  delay?: string;
}

function GameCard({ title, subtitle, reward, emoji, href, color, badge, locked, delay }: GameCardProps) {
  const neonClass = color === "cyan" ? "border-glow-cyan" : "border-glow-pink";
  const textColor = color === "cyan" ? "text-[#00f3ff]" : "text-[#ff00f0]";
  const glowClass = color === "cyan" ? "glow-cyan" : "glow-pink";

  const inner = (
    <div className={`
      relative glass-card rounded-2xl border p-4.5 overflow-hidden h-full flex flex-col justify-between
      transition-all duration-200 select-none touch-manipulation
      ${locked ? "locked-card opacity-60" : `${neonClass} hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${glowClass}`}
      animate-slide-up
    `} style={{ animationDelay: delay }}>
      <div className={`absolute inset-0 opacity-5 ${color === "cyan" ? "bg-gradient-to-br from-[#00f3ff] to-transparent" : "bg-gradient-to-br from-[#ff00f0] to-transparent"}`} />
      
      <div className="relative z-10 flex flex-col h-full justify-between gap-2.5">
        <div className="flex items-center justify-between">
          <div className="text-3xl flex-shrink-0 animate-float" style={{ animationDelay: delay }}>{emoji}</div>
          {badge && (
            <div className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${textColor} border-current opacity-90 tracking-wider uppercase`}>{badge}</div>
          )}
          {locked && <div className="text-gray-500 text-sm">🔒</div>}
        </div>
        
        <div className="flex-1 min-w-0">
          <h2 className={`text-sm sm:text-base font-black uppercase tracking-wider leading-tight ${locked ? "text-gray-500" : textColor}`}
            style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-1 leading-snug line-clamp-2">{subtitle}</p>
        </div>

        {!locked && (
          <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-[#1e1e40]">
            <span className="text-[10px] text-[#ffea00] font-bold">🪙 {reward}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${textColor} flex items-center gap-1`}>▶ PLAY NOW</span>
          </div>
        )}
        {locked && (
          <div className="mt-2 pt-2 border-t border-[#1e1e40]">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-black">Coming Soon</p>
          </div>
        )}
      </div>
    </div>
  );

  if (locked) return inner;
  return <Link href={href} className="block h-full">{inner}</Link>;
}

/* ─── Settings Drawer ─── */
function SettingsDrawer({ open, onClose, coins, resetAll }: {
  open: boolean; onClose: () => void; coins: number; resetAll: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-panel rounded-t-3xl border-t border-[#00f3ff33] p-6 animate-slide-up">
        <div className="w-10 h-1 bg-[#00f3ff44] rounded-full mx-auto mb-6" />
        <h3 className="text-[#00f3ff] font-black text-lg uppercase tracking-widest mb-4" style={{ fontFamily: "var(--font-display)" }}>Settings</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-[#1e1e40]">
            <span className="text-gray-300 text-sm">Total Coins</span>
            <span className="coin-glow font-bold">🪙 {coins.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-[#1e1e40]">
            <span className="text-gray-300 text-sm">Haptics</span>
            <span className="text-[#00ff88] text-sm font-bold">ON</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-[#1e1e40]">
            <span className="text-gray-300 text-sm">Theme</span>
            <span className="text-[#ff00f0] text-sm font-bold">Neon Cyberpunk</span>
          </div>
          <Link href="/shop"
            className="flex items-center justify-between py-3 border-b border-[#1e1e40] hover:text-[#ffea00] transition-colors"
            onClick={onClose}>
            <span className="text-gray-300 text-sm">Neon Shop</span>
            <span className="text-[#ffea00] font-bold">🛒 Open →</span>
          </Link>
          <button id="reset-coins-btn"
            className="w-full py-3 rounded-xl border border-red-500/40 text-red-400 text-sm font-bold uppercase tracking-wider hover:bg-red-500/10 transition-colors"
            onClick={() => { resetAll(); onClose(); window.location.reload(); }}>
            ⚠ Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN HOME PAGE
══════════════════════════════════════════ */
export default function HomePage() {
  const { coins, mounted, addCoins, updateStreak, streak, selectedAvatar, selectedArenaTheme, resetAll } = usePlayerStats();
  const { stats } = useSocket();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);
  const [streakResult, setStreakResult] = useState<StreakCheckResult | null>(null);
  const { playCoin } = useSound();

  const { getArenaThemeById } = require("@/lib/gameStore");
  const arena = getArenaThemeById(selectedArenaTheme);

  // Generate background particles mapped to selected theme colors
  useEffect(() => {
    setParticles(Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: [arena.colorPrimary, arena.colorSecondary, "#ffea00", "#ffffff"][Math.floor(Math.random() * 4)],
    })));
  }, [arena.colorPrimary, arena.colorSecondary]);

  // Check daily streak on mount
  useEffect(() => {
    if (!mounted) return;
    const { updated, result } = checkAndUpdateStreak(streak);
    if (result.isFirstVisitToday) {
      updateStreak(updated);
      setStreakResult(result);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleStreakClaim = () => {
    if (streakResult) {
      addCoins(streakResult.coinsBonus);
      playCoin();
    }
    setStreakResult(null);
  };

  const avatar = mounted ? getAvatarById(selectedAvatar) : { emoji: "🎮", glowColor: "#00f3ff", name: "Player" };

  return (
    <div className="relative min-h-dvh max-w-md mx-auto overflow-x-hidden w-full flex flex-col justify-between bg-[#06060f]"
      style={{
        backgroundImage: `
          linear-gradient(${arena.bgGridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${arena.bgGridColor} 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px"
      }}>

      {/* Ambient particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {particles.map((p) => (
          <div key={p.id} className="absolute w-1 h-1 rounded-full opacity-30 animate-float"
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.color, boxShadow: `0 0 6px 2px ${p.color}88`, animationDuration: `${3 + (p.id % 4)}s`, animationDelay: `${(p.id * 0.3) % 3}s` }} />
        ))}
      </div>

      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${arena.colorPrimary}0a 0%, transparent 70%)` }} aria-hidden="true" />

      <div className="relative z-10 flex flex-col min-h-dvh px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">

        {/* ── Top Bar ── */}
        <header className="flex items-center justify-between pt-[env(safe-area-inset-top)] py-4 sticky top-0 z-20">
          {/* Avatar */}
          <div className="glass-panel rounded-2xl px-3 py-2 flex items-center gap-2 border border-[#1e1e40]">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl border bg-[#0d0d1a]"
                style={{ borderColor: `${avatar.glowColor}44`, boxShadow: `0 0 8px ${avatar.glowColor}44` }}>
                {avatar.emoji}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#00ff88] rounded-full border border-[#06060f]" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">Player</p>
              <p className="text-xs font-bold leading-none mt-0.5" style={{ color: avatar.glowColor }}>CLASH PRO</p>
            </div>
          </div>

          {/* Coins */}
          <div id="coin-counter" className="glass-panel rounded-2xl px-4 py-2 flex items-center gap-2 border border-[#ffea0033]"
            style={{ boxShadow: "0 0 15px #ffea0015" }}>
            <span className="text-xl animate-bounce" style={{ animationDuration: "2s" }}>🪙</span>
            <CoinCounter coins={coins} mounted={mounted} />
          </div>

          {/* Settings */}
          <button id="settings-btn"
            className="glass-panel rounded-2xl w-11 h-11 flex items-center justify-center border border-[#1e1e40] hover:border-[#00f3ff44] transition-all duration-200 btn-press"
            onClick={() => setSettingsOpen(true)} aria-label="Open Settings">
            <span className="text-xl">⚙️</span>
          </button>
        </header>

        {/* ── Hero ── */}
        <section className="py-5 text-center animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="inline-block mb-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#00f3ff] font-bold border border-[#00f3ff33] rounded-full px-3 py-1"
               style={{ background: "rgba(0,243,255,0.05)" }}>
              ⚡ ONLINE: {stats.onlinePlayers || "1"} LIVE
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase leading-none tracking-tight mt-2 animate-neon-flicker" style={{ fontFamily: "var(--font-display)" }}>
            <span style={{ background: `linear-gradient(135deg, ${arena.colorPrimary}, ${arena.colorSecondary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Mini</span>
            <br />
            <span style={{ background: `linear-gradient(135deg, #ffea00, ${arena.colorPrimary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Clash</span>
          </h1>
          <p className="text-gray-400 mt-2.5 text-xs sm:text-sm font-medium tracking-wide">
            Select your battle. Destroy the competition.
            <br /><span className="text-[#ff00f0] font-semibold">No mercy. All glory.</span>
          </p>

          {/* Shop shortcut */}
          <Link href="/shop"
            className="inline-flex items-center gap-2 mt-3.5 px-4 py-1.5 rounded-full border border-[#ffea0033] bg-[#ffea0008] text-[#ffea00] text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-[#ffea0015] transition-colors btn-press">
            🛒 Neon Shop
            <span className="text-gray-500 normal-case font-normal">— Spend Coins</span>
          </Link>

          <div className="flex items-center gap-3 mt-4.5 max-w-xs mx-auto">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#00f3ff44]" />
            <span className="text-[#00f3ff] text-[10px] sm:text-xs font-bold uppercase tracking-widest">Choose Game</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#00f3ff44]" />
          </div>
        </section>

        {/* ── Game Grid ── */}
        <main className="flex-1 grid grid-cols-2 gap-3 sm:gap-4 mt-2">
          <GameCard title="Neon XO Speedrun" subtitle="2P Tic-Tac-Toe with a 3-second shot clock. Rapid ticks!" reward="50 Coins" emoji="⚡" href="/games/xo" color="cyan" badge="2P / BOT" delay="0.1s" />
          <GameCard title="Rage Tap Battle" subtitle="Split-screen tug-of-war! Out-tap in 15 seconds." reward="100 Coins" emoji="👊" href="/games/rage-tap" color="pink" badge="HOT 🔥" delay="0.15s" />
          <GameCard title="Speed Math Blitz" subtitle="Race to solve equations. Mental speed warfare." reward="75 Coins" emoji="🧠" href="#" color="cyan" locked delay="0.2s" />
          <GameCard title="Reflex Rush" subtitle="Last to tap the vanishing target loses. pure reflexes." reward="60 Coins" emoji="🎯" href="#" color="pink" locked delay="0.25s" />
        </main> mental warfare." reward="+75 Coins" emoji="🧠" href="#" color="cyan" locked delay="0.2s" />
          <GameCard title="Reflex Rush" subtitle="Last to tap the vanishing target loses. Pure reflexes, zero mercy." reward="+60 Coins" emoji="🎯" href="#" color="pink" locked delay="0.25s" />
        </main>

        {/* ── Streak info bar ── */}
        {mounted && streak.count > 0 && (
          <div className="mt-5 glass-card rounded-2xl border border-[#ff660033] p-3 flex items-center gap-3 animate-slide-up">
            <span className="text-2xl">🔥</span>
            <div className="flex-1">
              <p className="text-[#ff6600] font-black text-sm uppercase tracking-wider">Day {streak.count} Streak</p>
              <p className="text-gray-500 text-xs">Come back tomorrow for more coins!</p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(streak.count, 5) }).map((_, i) => (
                <div key={i} className="w-1.5 h-4 rounded-full bg-[#ff6600]" style={{ boxShadow: "0 0 4px #ff6600" }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Stats Bar ── */}
        <footer className="mt-4 glass-panel rounded-2xl border border-[#1e1e40] p-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Games</p>
              <p className="text-[#00f3ff] font-black text-lg" style={{ fontFamily: "var(--font-display)" }}>2</p>
            </div>
            <div className="border-x border-[#1e1e40]">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Coins</p>
              <p className="coin-glow font-black text-lg" style={{ fontFamily: "var(--font-display)" }}>
                {mounted ? coins.toLocaleString() : "···"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Streak</p>
              <p className="text-[#ff6600] font-black text-lg" style={{ fontFamily: "var(--font-display)" }}>
                {mounted ? streak.count : "·"}🔥
              </p>
            </div>
          </div>
        </footer>

        <p className="text-center text-[10px] text-gray-700 mt-4 uppercase tracking-widest">Mini Clash v2.0 — Neon Arcade</p>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} coins={coins} resetAll={resetAll} />

      {/* Daily Streak Popup */}
      {streakResult && streakResult.isFirstVisitToday && (
        <StreakPopup result={streakResult} onClaim={handleStreakClaim} />
      )}
    </div>
  );
}
