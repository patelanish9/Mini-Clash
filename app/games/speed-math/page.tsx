"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useSound } from "@/hooks/useSound";
import { useWakeLock } from "@/hooks/useWakeLock";
import { getArenaThemeById } from "@/lib/gameStore";

/* ─── Math Engine Types & Helpers ─── */
interface MathProblem {
  question: string;
  answer: number;
  options: number[];
}

function generateProblem(): MathProblem {
  const operators = ["+", "-", "×"] as const;
  const op = operators[Math.floor(Math.random() * operators.length)];
  let num1 = 0;
  let num2 = 0;
  let answer = 0;
  let question = "";

  if (op === "+") {
    num1 = Math.floor(Math.random() * 20) + 1;
    num2 = Math.floor(Math.random() * 20) + 1;
    answer = num1 + num2;
    question = `${num1} + ${num2}`;
  } else if (op === "-") {
    num1 = Math.floor(Math.random() * 20) + 1;
    num2 = Math.floor(Math.random() * num1) + 1; // prevent negative results
    answer = num1 - num2;
    question = `${num1} - ${num2}`;
  } else {
    // Keep multiplication within single digits for lightning-fast calculations
    num1 = Math.floor(Math.random() * 9) + 2;
    num2 = Math.floor(Math.random() * 9) + 2;
    answer = num1 * num2;
    question = `${num1} × ${num2}`;
  }

  // Generate 3 unique incorrect answers close to the correct value
  const incorrects = new Set<number>();
  while (incorrects.size < 3) {
    const offset = Math.floor(Math.random() * 9) - 4; // close range -4 to +4
    const fake = answer + offset;
    if (fake !== answer && fake >= 0) {
      incorrects.add(fake);
    }
  }

  const options = [answer, ...Array.from(incorrects)];
  // Shuffle options array using Fisher-Yates
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { question, answer, options };
}

type GamePhase = "idle" | "countdown" | "playing" | "won";

/* ─── Winner Modal Component ─── */
interface WinnerModalProps {
  p1Score: number;
  p2Score: number;
  reward: number;
  onRematch: () => void;
  onHome: () => void;
  onShare: () => void;
  hapticsEnabled: boolean;
}

function WinnerModal({
  p1Score,
  p2Score,
  reward,
  onRematch,
  onHome,
  onShare,
  hapticsEnabled,
}: WinnerModalProps) {
  const [stars, setStars] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);

  const isDraw = p1Score === p2Score;
  const p1Won = p1Score > p2Score;
  const winColor = isDraw ? "#ffea00" : p1Won ? "#00f3ff" : "#ff00f0";

  useEffect(() => {
    setStars(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
        color: ["#00f3ff", "#ff00f0", "#ffea00", "#00ff88"][i % 4],
      }))
    );
    if (hapticsEnabled && navigator.vibrate) {
      navigator.vibrate([100, 60, 100, 60, 300]);
    }
  }, [hapticsEnabled]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute w-2 h-2 rounded-full pointer-events-none"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            background: s.color,
            boxShadow: `0 0 8px 2px ${s.color}`,
            animation: `star-burst 0.9s ease-out ${s.id * 0.04}s both`,
          }}
        />
      ))}

      <div
        className="relative w-full max-w-sm glass-card rounded-3xl border p-8 text-center animate-winner-appear"
        style={{
          borderColor: `${winColor}33`,
          boxShadow: `0 0 60px ${winColor}22`,
        }}
      >
        <div
          className="absolute inset-0 rounded-3xl opacity-10 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${winColor}44, transparent 70%)`,
          }}
        />

        <div className="text-7xl mb-3">{isDraw ? "🤝" : "🏆"}</div>

        <h2
          className="text-3xl font-black uppercase mb-1"
          style={{
            fontFamily: "var(--font-display)",
            color: winColor,
            textShadow: `0 0 20px ${winColor}`,
          }}
        >
          {isDraw ? "DRAW!" : p1Won ? "P1 VICTORIOUS!" : "P2 VICTORIOUS!"}
        </h2>
        <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-4">
          Speed Math Blitz Match
        </p>

        {/* Score comparison card */}
        <div className="grid grid-cols-2 gap-3 my-5">
          <div className="glass-card rounded-2xl p-4.5 border border-[#00f3ff33]">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Player 1 (Cyan)</p>
            <p
              className="text-3xl font-black mt-1 text-[#00f3ff]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {p1Score}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-4.5 border border-[#ff00f033]">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Player 2 (Pink)</p>
            <p
              className="text-3xl font-black mt-1 text-[#ff00f0]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {p2Score}
            </p>
          </div>
        </div>

        {/* Coin reward status */}
        <div className="flex items-center justify-center gap-2.5 my-5 p-3 rounded-xl bg-[#ffea0010] border border-[#ffea0033]">
          <span className="text-2xl animate-bounce" style={{ animationDuration: "2s" }}>
            🪙
          </span>
          <div className="text-left">
            <span className="text-[#ffea00] text-xl font-black coin-glow">+{reward} Coins</span>
            <p className="text-gray-500 text-[9px] uppercase tracking-wider">Blitz Battle Reward</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <button
            id="math-share-btn"
            className="w-full py-3 rounded-xl font-black uppercase tracking-wider text-sm btn-press bg-gradient-to-r from-[#ffea00] to-[#ff6b00] text-black shadow-md"
            onClick={onShare}
          >
            📢 Share Scorecard
          </button>

          <div className="flex gap-3">
            <button
              id="math-rematch-btn"
              className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs btn-press border border-[#00f3ff44] text-[#00f3ff] hover:bg-[#00f3ff15] transition-all"
              onClick={onRematch}
            >
              🔄 Rematch
            </button>
            <button
              id="math-home-btn"
              className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs btn-press bg-[#ff00f022] border border-[#ff00f044] text-[#ff00f0]"
              onClick={onHome}
            >
              🏠 HUB
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes star-burst {
          0% { transform: scale(0) translate(0, 0); opacity: 1; }
          100% { transform: scale(1) translate(var(--tw-translate-x), var(--tw-translate-y)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ─── Main Internal Page Component ─── */
function SpeedMathInner() {
  const { addCoins, addMatchLog, mounted, selectedArenaTheme, hapticsEnabled } = usePlayerStats();
  const { playPop, playCountdown, playWin, playLose, playTimerWarning, playError } = useSound();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  const arena = getArenaThemeById(selectedArenaTheme);

  /* State Hooks */
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);

  /* Shake / Flash feedback triggers */
  const [p1Shaking, setP1Shaking] = useState(false);
  const [p2Shaking, setP2Shaking] = useState(false);

  const [rewardGiven, setRewardGiven] = useState(false);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const REWARD_AMOUNT = 75;

  /* Start game workflow */
  const startGame = useCallback(() => {
    setCountdown(3);
    setTimeLeft(60);
    setP1Score(0);
    setP2Score(0);
    setCurrentProblem(generateProblem());
    setP1Shaking(false);
    setP2Shaking(false);
    setRewardGiven(false);
    setPhase("countdown");
  }, []);

  /* Local countdown timer logic */
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown < 0) {
      setPhase("playing");
      return;
    }
    playCountdown(countdown);
    if (countdown === 0) {
      countdownTimerRef.current = setTimeout(() => setPhase("playing"), 600);
      return () => {
        if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      };
    }
    countdownTimerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [phase, countdown, playCountdown]);

  /* Main gameplay game timer countdown */
  useEffect(() => {
    if (phase !== "playing") return;

    gameTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 5 && next > 0) {
          playTimerWarning();
        }
        if (next <= 0) {
          setPhase("won");
          if (gameTimerRef.current) clearInterval(gameTimerRef.current);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, [phase, playTimerWarning]);

  /* Award coins & match metrics when game finishes */
  useEffect(() => {
    if (phase === "won" && mounted && !rewardGiven) {
      const isDraw = p1Score === p2Score;
      const p1Won = p1Score > p2Score;

      let outcome: "Won" | "Lost" | "Draw" = "Draw";
      let rewardEarned = 15; // draw minor coins

      if (!isDraw) {
        outcome = p1Won ? "Won" : "Lost"; // P1 centric perspective
        rewardEarned = REWARD_AMOUNT;
      }

      // Add to match history logs
      addMatchLog("Speed Math", outcome, rewardEarned, outcome === "Won" ? 45 : 10);
      addCoins(rewardEarned);

      if (p1Won) {
        playWin();
      } else if (p2Score > p1Score) {
        playWin(); // split screen both win local
      } else {
        playLose();
      }

      setRewardGiven(true);
    }
  }, [phase, p1Score, p2Score, mounted, rewardGiven, addCoins, addMatchLog, playWin, playLose]);

  /* Screen lock during active gameplay */
  useEffect(() => {
    if (phase === "playing" || phase === "countdown") {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [phase, requestWakeLock, releaseWakeLock]);

  /* Handle option select click */
  const handleOptionSelect = (player: 1 | 2, option: number) => {
    if (phase !== "playing" || !currentProblem) return;

    if (option === currentProblem.answer) {
      // Correct!
      playPop();
      if (hapticsEnabled && navigator.vibrate) {
        navigator.vibrate([50]);
      }

      if (player === 1) {
        setP1Score((s) => s + 1);
      } else {
        setP2Score((s) => s + 1);
      }

      // Transition instantly to a new mathematical problem
      setCurrentProblem(generateProblem());
    } else {
      // Incorrect!
      playError();
      if (hapticsEnabled && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      if (player === 1) {
        setP1Score((s) => Math.max(0, s - 1));
        setP1Shaking(true);
        setTimeout(() => setP1Shaking(false), 500);
      } else {
        setP2Score((s) => Math.max(0, s - 1));
        setP2Shaking(true);
        setTimeout(() => setP2Shaking(false), 500);
      }
    }
  };

  /* Render glowing scorecard and share natively */
  const handleShareScorecard = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    const grad = ctx.createRadialGradient(300, 300, 50, 300, 300, 450);
    grad.addColorStop(0, "#13132b");
    grad.addColorStop(1, "#06060f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 600);

    // Neon divider lines
    ctx.strokeStyle = "rgba(0, 243, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 600; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, 600);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i); ctx.lineTo(600, i);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = "#ffea00";
    ctx.font = "black 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SPEED MATH BLITZ", 300, 100);

    // Scores
    ctx.fillStyle = "#00f3ff";
    ctx.font = "black 72px sans-serif";
    ctx.fillText(p1Score.toString(), 200, 280);
    ctx.fillStyle = "#ff00f0";
    ctx.fillText(p2Score.toString(), 400, 280);

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px sans-serif";
    ctx.fillText("P1 CYAN", 200, 340);
    ctx.fillText("P2 PINK", 400, 340);

    // Winner declaration
    let message = "IT'S A DRAW! 🤝";
    if (p1Score > p2Score) message = "P1 CYAN DOMINATES! 🏆";
    if (p2Score > p1Score) message = "P2 PINK DOMINATES! 🏆";

    ctx.fillStyle = p1Score === p2Score ? "#ffea00" : p1Score > p2Score ? "#00f3ff" : "#ff00f0";
    ctx.font = "black 28px sans-serif";
    ctx.fillText(message, 300, 440);

    ctx.fillStyle = "#777799";
    ctx.font = "14px sans-serif";
    ctx.fillText("BATTLE LIVE ON MINI CLASH", 300, 520);

    const imgUrl = canvas.toDataURL("image/png");
    if (navigator.share) {
      fetch(imgUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "mathscore.png", { type: "image/png" });
          navigator.share({
            files: [file],
            title: "Speed Math Scorecard",
            text: `Speed Math Blitz! P1 score: ${p1Score} · P2 score: ${p2Score}! Can you match my mental speed?`,
          });
        })
        .catch(() => {});
    } else {
      const inviteUrl = window.location.origin;
      const text = `Speed Math Blitz! P1: ${p1Score} · P2: ${p2Score}. Battle me on Mini Clash: ${inviteUrl}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  return (
    <div
      className="relative h-full w-full flex flex-col overflow-hidden bg-[#06060f]"
      style={{
        backgroundImage: `
          linear-gradient(${arena.bgGridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${arena.bgGridColor} 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    >
      {/* ── Background Gradients ── */}
      <div
        className="absolute top-0 left-0 right-0 h-1/3 pointer-events-none opacity-20"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${arena.colorSecondary}aa 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none opacity-20"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${arena.colorPrimary}aa 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col justify-between max-w-md mx-auto w-full h-full select-none touch-action-manipulation overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        
        {/* ── PLAYER 2 ZONE (TOP HALF - ROTATED 180 DEG) ── */}
        <div
          className={`flex-1 flex flex-col justify-between p-6 rotate-180 transition-all duration-300 ${
            p2Shaking ? "animate-shake bg-[#ff00f010] border-t border-[#ff00f044]" : ""
          }`}
        >
          {/* Player stats top bar */}
          <div className="flex justify-between items-center">
            <span
              className="text-[#ff00f0] font-black uppercase text-xs tracking-wider"
              style={{ fontFamily: "var(--font-display)" }}
            >
              PLAYER 2 (PINK)
            </span>
            <div className="glass-card rounded-xl px-4 py-1.5 border border-[#ff00f033] flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Score</span>
              <span className="text-[#ff00f0] font-bold text-base tabular-nums">{p2Score}</span>
            </div>
          </div>

          {/* Math Problem Card */}
          <div className="flex-1 flex items-center justify-center py-4">
            {phase === "playing" && currentProblem ? (
              <div
                className="glass-card rounded-3xl border border-[#ff00f033] w-full py-8 text-center"
                style={{ boxShadow: "0 0 25px rgba(255, 0, 240, 0.08)" }}
              >
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Solve Fast!
                </p>
                <h3
                  className="text-4xl sm:text-5xl font-black text-white leading-none"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {currentProblem.question}
                </h3>
              </div>
            ) : (
              <div className="text-gray-600 text-xs tracking-widest uppercase">Lobby Waiting</div>
            )}
          </div>

          {/* 2x2 Glowing Grid options */}
          <div className="grid grid-cols-2 gap-3 mt-auto">
            {phase === "playing" && currentProblem
              ? currentProblem.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionSelect(2, opt)}
                    className="py-4.5 rounded-2xl glass-card border border-[#ff00f033] text-white font-black text-lg btn-press flex items-center justify-center transition-all hover:border-[#ff00f088] active:bg-[#ff00f015] shadow-sm select-none cursor-pointer"
                  >
                    {opt}
                  </button>
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="py-4.5 rounded-2xl glass-card border border-[#1e1e40] bg-black/10 flex items-center justify-center opacity-40"
                  />
                ))}
          </div>
        </div>

        {/* ── MIDDLE CENTRAL TIMER PROGRESS DIVISION BAR ── */}
        <div className="relative h-10 w-full flex items-center justify-center flex-shrink-0 z-30">
          <div
            className="absolute inset-x-0 h-0.5"
            style={{
              background: `linear-gradient(90deg, ${arena.colorSecondary}, ${arena.colorPrimary})`,
              boxShadow: `0 0 8px ${arena.colorPrimary}`,
            }}
          />

          <div
            className="relative glass-card rounded-full border border-gray-800 px-5 py-1.5 flex items-center justify-center shadow-lg"
            style={{
              background: "#080812",
              borderColor: timeLeft <= 5 && phase === "playing" ? "#ff2200" : "#222238",
              boxShadow: timeLeft <= 5 && phase === "playing" ? "0 0 15px #ff220055" : "none",
            }}
          >
            {phase === "playing" ? (
              <span
                className={`text-sm font-black tabular-nums ${
                  timeLeft <= 5 ? "text-red-500 animate-pulse font-black text-base" : "text-white"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                ⏱️ {timeLeft}s
              </span>
            ) : phase === "countdown" ? (
              <span
                className="text-[#ffea00] font-black text-sm uppercase animate-double-flash"
                style={{ fontFamily: "var(--font-display)", textShadow: "0 0 8px #ffea0088" }}
              >
                {countdown === 0 ? "GO!" : countdown}
              </span>
            ) : (
              <span
                className="text-[#ffea00] font-black text-[10px] tracking-wider uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Blitz
              </span>
            )}
          </div>
        </div>

        {/* ── PLAYER 1 ZONE (BOTTOM HALF - NORMAL FACING) ── */}
        <div
          className={`flex-1 flex flex-col justify-between p-6 transition-all duration-300 ${
            p1Shaking ? "animate-shake bg-[#00f3ff10] border-b border-[#00f3ff44]" : ""
          }`}
        >
          {/* 2x2 Glowing Grid options */}
          <div className="grid grid-cols-2 gap-3 mb-auto">
            {phase === "playing" && currentProblem
              ? currentProblem.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionSelect(1, opt)}
                    className="py-4.5 rounded-2xl glass-card border border-[#00f3ff33] text-white font-black text-lg btn-press flex items-center justify-center transition-all hover:border-[#00f3ff88] active:bg-[#00f3ff15] shadow-sm select-none cursor-pointer"
                  >
                    {opt}
                  </button>
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="py-4.5 rounded-2xl glass-card border border-[#1e1e40] bg-black/10 flex items-center justify-center opacity-40"
                  />
                ))}
          </div>

          {/* Math Problem Card */}
          <div className="flex-1 flex items-center justify-center py-4">
            {phase === "playing" && currentProblem ? (
              <div
                className="glass-card rounded-3xl border border-[#00f3ff33] w-full py-8 text-center"
                style={{ boxShadow: "0 0 25px rgba(0, 243, 255, 0.08)" }}
              >
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Solve Fast!
                </p>
                <h3
                  className="text-4xl sm:text-5xl font-black text-white leading-none"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {currentProblem.question}
                </h3>
              </div>
            ) : phase === "countdown" ? (
              <div className="text-center animate-bounce">
                <span className="text-4xl">🧠</span>
                <p className="text-[#ffea00] font-black tracking-widest text-xs uppercase mt-2">Get ready!</p>
              </div>
            ) : (
              <button
                id="math-start-game-btn"
                onClick={startGame}
                className="w-full max-w-xs py-4.5 rounded-2xl font-black text-lg uppercase tracking-widest text-[#06060f] btn-press select-none cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${arena.colorPrimary}, ${arena.colorSecondary})`,
                  boxShadow: `0 0 35px ${arena.colorPrimary}66`,
                }}
              >
                ⚔️ START BLITZ
              </button>
            )}
          </div>

          {/* Player stats bottom bar */}
          <div className="flex justify-between items-center mt-auto">
            <span
              className="text-[#00f3ff] font-black uppercase text-xs tracking-wider"
              style={{ fontFamily: "var(--font-display)" }}
            >
              PLAYER 1 (CYAN)
            </span>
            <div className="glass-card rounded-xl px-4 py-1.5 border border-[#00f3ff33] flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Score</span>
              <span className="text-[#00f3ff] font-bold text-base tabular-nums">{p1Score}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── WINNER MODAL ── */}
      {phase === "won" && (
        <WinnerModal
          p1Score={p1Score}
          p2Score={p2Score}
          reward={p1Score === p2Score ? 15 : REWARD_AMOUNT}
          onRematch={startGame}
          onHome={() => {
            setPhase("idle");
            setP1Score(0);
            setP2Score(0);
          }}
          onShare={handleShareScorecard}
          hapticsEnabled={hapticsEnabled}
        />
      )}

      {/* Shake Keyframe animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default function SpeedMathPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh max-w-md mx-auto bg-[#06060f] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[#00f3ff] border-[#1e1e40] rounded-full animate-spin"></div>
        </div>
      }
    >
      <SpeedMathInner />
    </Suspense>
  );
}
