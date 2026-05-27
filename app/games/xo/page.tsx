"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useSound } from "@/hooks/useSound";
import { getSkinById, XOSkin, getAvatarById, getEmotePackById, getArenaThemeById } from "@/lib/gameStore";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";

/* ─── Types ─── */
type Cell = "X" | "O" | null;
type Player = "X" | "O";
type GamePhase = "idle" | "playing" | "won" | "draw";

const BASE_REWARD = 50;
const TURN_LIMIT_MS = 3000;

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Cell[]): { winner: Player; line: number[] } | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line: [a, b, c] };
    }
  }
  return null;
}

function findBestMove(currentBoard: Cell[]): number {
  // 1. Win Condition: If bot ('O') can win in one move, it MUST take that spot
  for (let i = 0; i < 9; i++) {
    if (currentBoard[i] === null) {
      const testBoard = [...currentBoard];
      testBoard[i] = "O";
      const result = checkWinner(testBoard);
      if (result && result.winner === "O") return i;
    }
  }

  // 2. Block Condition: If player ('X') is about to win, bot ('O') MUST block
  for (let i = 0; i < 9; i++) {
    if (currentBoard[i] === null) {
      const testBoard = [...currentBoard];
      testBoard[i] = "X";
      const result = checkWinner(testBoard);
      if (result && result.winner === "X") return i;
    }
  }

  // 3. Random Move fallback
  const emptyIndices: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (currentBoard[i] === null) {
      emptyIndices.push(i);
    }
  }
  if (emptyIndices.length > 0) {
    const randomIndex = Math.floor(Math.random() * emptyIndices.length);
    return emptyIndices[randomIndex];
  }
  return -1;
}

/* ─── Emote system ─── */
interface FloatingEmote {
  id: number;
  emoji: string;
  x: number;
  y: number;
}

function EmoteBar({ emotes, onSend }: { emotes: string[]; onSend: (emoji: string) => void }) {
  return (
    <div className="fixed bottom-6 left-3 z-30 flex flex-col gap-2">
      {emotes.map((emoji) => (
        <button
          key={emoji}
          className="w-10 h-10 rounded-xl glass-card border border-[#ffffff11] flex items-center justify-center text-xl btn-press hover:border-[#ff00f044] active:scale-90 transition-all shadow-lg"
          onClick={() => onSend(emoji)}
          aria-label={`Send ${emoji} emote`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function FloatingEmoteLayer({ emotes }: { emotes: FloatingEmote[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {emotes.map((e) => (
        <div
          key={e.id}
          className="absolute text-5xl animate-emote-float select-none"
          style={{ left: e.x, top: e.y }}
        >
          {e.emoji}
        </div>
      ))}
    </div>
  );
}

/* ─── Timer bar ─── */
function TimerBar({ active, onExpire, arena }: { active: boolean; onExpire: () => void; arena: any }) {
  const barRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    if (barRef.current) {
      barRef.current.style.transition = "none";
      barRef.current.style.width = "100%";
      void barRef.current.offsetWidth;
      barRef.current.style.transition = `width ${TURN_LIMIT_MS}ms linear`;
      barRef.current.style.width = "0%";
    }
    timeoutRef.current = setTimeout(onExpire, TURN_LIMIT_MS);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [active, onExpire]);

  return (
    <div className="w-full h-3 rounded-full bg-[#1e1e40] overflow-hidden border border-[#2a2a50]">
      <div
        ref={barRef}
        className="h-full rounded-full"
        style={{
          width: active ? "100%" : "0%",
          background: `linear-gradient(90deg, ${arena.colorSecondary}, ${arena.colorPrimary})`,
          boxShadow: `0 0 8px ${arena.colorPrimary}aa`,
        }}
      />
    </div>
  );
}

/* ─── XO Cell ─── */
function XOCell({
  value, index, onClick, isWinning, disabled, skin, arena,
}: {
  value: Cell; index: number; onClick: () => void;
  isWinning: boolean; disabled: boolean; skin: XOSkin; arena: any;
}) {
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    if (disabled || value) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 150);
    if (navigator.vibrate) navigator.vibrate([50]);
    onClick();
  };

  const displayChar = value === "X" ? skin.xMark : value === "O" ? skin.oMark : null;
  const displayColor = value === "X" ? skin.colorX : skin.colorO;

  return (
    <button
      id={`xo-cell-${index}`}
      className={`
        xo-cell rounded-2xl aspect-square flex items-center justify-center
        select-none touch-manipulation transition-transform duration-150
        ${value ? "filled" : ""}
        ${isWinning ? "border-2" : ""}
        ${pressed ? "scale-[0.92]" : "scale-100 active:scale-95"}
      `}
      style={
        isWinning
          ? { borderColor: displayColor, boxShadow: `0 0 20px ${displayColor}55`, background: `${displayColor}10` }
          : !value && !disabled
          ? { borderColor: `${arena.colorPrimary}44`, background: `${arena.colorPrimary}03` }
          : { borderColor: `${arena.colorPrimary}22` }
      }
      onClick={handleClick}
      disabled={disabled}
      aria-label={value ? `Cell ${index + 1}: ${value}` : `Cell ${index + 1}: empty`}
    >
      {displayChar && (
        <span
          className="animate-pop-in leading-none"
          style={{
            color: displayColor,
            textShadow: `0 0 12px ${displayColor}, 0 0 30px ${displayColor}88`,
            fontSize: skin.id === "default_xo" ? "2.5rem" : "2.2rem",
            fontWeight: 900,
          }}
        >
          {displayChar}
        </span>
      )}
    </button>
  );
}

/* ─── Double or Nothing Modal ─── */
function DoubleOrNothingModal({
  currentStake,
  doubledStake,
  onAccept,
  onDecline,
}: {
  currentStake: number;
  doubledStake: number;
  onAccept: () => void;
  onDecline: () => void;
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
        <p className="text-gray-400 text-sm mt-2">Accept the rematch and double the prize pool!</p>

        <div className="grid grid-cols-2 gap-3 my-6">
          <div className="glass-card rounded-xl p-3 border border-[#1e1e40]">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Current Stake</p>
            <p className="text-[#ffea00] font-black text-2xl mt-1">🪙 {currentStake}</p>
          </div>
          <div className="glass-card rounded-xl p-3 border border-[#ffea0044]"
            style={{ boxShadow: "0 0 15px #ffea0022" }}>
            <p className="text-[10px] text-[#ffea00] uppercase tracking-widest font-bold">Next Winner Gets</p>
            <p className="text-[#ffea00] font-black text-2xl mt-1 animate-double-flash">🪙 {doubledStake}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            id="double-accept-btn"
            className="flex-1 py-3 rounded-xl font-black uppercase tracking-wider text-sm btn-press text-[#06060f]"
            style={{ background: "linear-gradient(135deg, #ffea00, #ff6b00)", boxShadow: "0 0 20px #ffea0055" }}
            onClick={onAccept}
          >
            🔥 DOUBLE IT
          </button>
          <button
            id="double-decline-btn"
            className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm btn-press border border-[#1e1e40] text-gray-400 hover:text-white transition-colors"
            onClick={onDecline}
          >
            Normal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Winner Modal ─── */
interface WinnerModalProps {
  winner: Player | null;
  isDraw: boolean;
  reward: number;
  isEscalated: boolean;
  onRematch: () => void;
  onHome: () => void;
  onShare: () => void;
  gameMode?: "local" | "online" | "bot";
}

function WinnerModal({
  winner, isDraw, reward, isEscalated, onRematch, onHome, onShare, gameMode
}: WinnerModalProps) {
  const [stars, setStars] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);

  useEffect(() => {
    setStars(Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      color: ["#00f3ff", "#ff00f0", "#ffea00", "#00ff88"][i % 4],
    })));
    if (navigator.vibrate) navigator.vibrate([80, 50, 80, 50, 200]);
  }, []);

  const winColor = isDraw ? "#ffea00" : winner === "X" ? "#00f3ff" : "#ff00f0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      {stars.map((s) => (
        <div key={s.id} className="absolute w-2 h-2 rounded-full pointer-events-none"
          style={{ left: `${s.x}%`, top: `${s.y}%`, background: s.color, boxShadow: `0 0 8px 2px ${s.color}`, animation: `star-burst 0.8s ease-out ${s.id * 0.05}s both` }} />
      ))}

      <div className="relative w-full max-w-sm glass-card rounded-3xl border p-8 text-center animate-winner-appear"
        style={{ borderColor: `${winColor}33`, boxShadow: `0 0 60px ${winColor}22` }}>
        <div className="absolute inset-0 rounded-3xl opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${winColor}44, transparent 70%)` }} />

        <div className="text-7xl mb-4">{isDraw ? "🤝" : "🏆"}</div>

        <h2 className="text-4xl font-black uppercase mb-2"
          style={{ fontFamily: "var(--font-display)", color: winColor, textShadow: `0 0 20px ${winColor}` }}>
          {isDraw ? "DRAW!" : "WINNER!"}
        </h2>

        {!isDraw && (
          <p className="text-2xl font-bold mb-1" style={{ color: winColor }}>
            {gameMode === "bot"
              ? (winner === "X" ? "You (P1)" : "Smart Bot (P2)")
              : `Player ${winner === "X" ? "1" : "2"} (${winner})`
            }
          </p>
        )}

        {!isDraw && (gameMode !== "bot" || winner === "X" ? (
          <div className="flex items-center justify-center gap-2 my-4 p-3 rounded-xl bg-[#ffea0015] border border-[#ffea0033]">
            <span className="text-2xl">🪙</span>
            <div>
              <span className="text-[#ffea00] text-2xl font-black coin-glow">+{reward}</span>
              {isEscalated && (
                <span className="ml-2 text-xs text-[#ff6600] font-bold uppercase">🔥 ESCALATED!</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 my-4">No coins awarded. Better luck next time!</p>
        ))}
        {isDraw && <p className="text-gray-400 my-4">No coins awarded. Rematch!</p>}

        <div className="flex flex-col gap-3 mt-6">
          {/* Share score scorecard button */}
          <button id="xo-share-btn"
            className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-sm btn-press bg-gradient-to-r from-[#ffea00] to-[#ff6b00] text-black shadow-md"
            onClick={onShare}>
            📢 Share Scorecard
          </button>
          
          <div className="flex gap-3">
            <button id="xo-rematch-btn"
              className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm btn-press border border-[#00f3ff44] text-[#00f3ff] hover:bg-[#00f3ff15] transition-all"
              onClick={onRematch}>
              🔄 Rematch
            </button>
            <button id="xo-home-btn"
              className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm btn-press bg-[#ff00f022] border border-[#ff00f044] text-[#ff00f0]"
              onClick={onHome}>
              🏠 Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN INTERNAL CLIENT COMPONENT
══════════════════════════════════════ */
function XOSpeedrunInner() {
  const { addCoins, mounted, selectedXOSkin, selectedAvatar, selectedEmotePack, selectedArenaTheme } = usePlayerStats();
  const { playPop, playTick, playTimerWarning, playWin, playLose, playEmote } = useSound();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");

  // Online Multiplayer Socket state
  const { connected, stats, findMatch, leaveMatch, emitAction, joinPrivateRoom, socket } = useSocket();
  const [gameMode, setGameMode] = useState<"local" | "online" | "bot">("local");
  const [isSearching, setIsSearching] = useState(false);
  const [myRole, setMyRole] = useState<Player | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<{ name: string; avatarEmoji: string; avatarGlowColor: string } | null>(null);

  // Private Friends Lobbies Lobbies States
  const [isPrivateLobby, setIsPrivateLobby] = useState(false);
  const [privateRoomCode, setPrivateRoomCode] = useState("");
  const [privateLobbyStatus, setPrivateLobbyStatus] = useState<"idle" | "waiting" | "ready">("idle");

  const skin = mounted ? getSkinById(selectedXOSkin) : getSkinById("default_xo");
  const currentAvatar = mounted ? getAvatarById(selectedAvatar) : { emoji: "🎮", glowColor: "#00f3ff", name: "Player" };

  const emotePack = getEmotePackById(selectedEmotePack);
  const activeEmotes = emotePack.emotes;
  const arena = getArenaThemeById(selectedArenaTheme);

  // WebRTC Live Voice Chat Hook
  const { voiceActive, peerState, toggleVoiceChat } = useWebRTC({
    socket,
    connected,
    gameMode,
    myRole,
    emitAction
  });

  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>("X");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [winResult, setWinResult] = useState<{ winner: Player; line: number[] } | null>(null);
  const [timerKey, setTimerKey] = useState("t0");

  // Escalation
  const [currentStake, setCurrentStake] = useState(BASE_REWARD);
  const [showDoubleModal, setShowDoubleModal] = useState(false);
  const [pendingRematch, setPendingRematch] = useState(false);

  // Emotes
  const emoteId = useRef(0);
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);

  // Reward tracking
  const [rewardGiven, setRewardGiven] = useState(false);

  // Parse invite room parameters from query URL
  useEffect(() => {
    if (roomParam && mounted && connected) {
      setGameMode("online");
      setIsSearching(false);
      setIsPrivateLobby(true);
      setPrivateRoomCode(roomParam.toUpperCase());
      setPrivateLobbyStatus("ready");
      joinPrivateRoom("join", "xo", roomParam, {
        name: "CLASH PRO",
        avatarEmoji: currentAvatar.emoji,
        avatarGlowColor: currentAvatar.glowColor
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam, mounted, connected]);

  // Give coins on win (Only Local Mode — Online Mode is handled by verified server tokens)
  useEffect(() => {
    if (gameMode === "online") return;
    if (phase === "won" && winResult && mounted && !rewardGiven) {
      if (gameMode === "bot") {
        if (winResult.winner === "X") {
          addCoins(currentStake);
          playWin();
        } else {
          playLose();
        }
      } else {
        addCoins(currentStake);
        playWin();
      }
      setRewardGiven(true);
    }
    if (phase === "draw") {
      playLose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, winResult, mounted]);

  // Bot thinking simulation loop
  useEffect(() => {
    if (gameMode !== "bot" || phase !== "playing" || currentPlayer !== "O") return;

    const thinkingTime = Math.floor(Math.random() * (1200 - 600 + 1)) + 600;
    const timer = setTimeout(() => {
      const bestMove = findBestMove(board);
      if (bestMove !== -1) {
        const newBoard = [...board];
        newBoard[bestMove] = "O";
        setBoard(newBoard);
        playPop();

        const result = checkWinner(newBoard);
        if (result) {
          setWinResult(result);
          setPhase("won");
          return;
        }
        if (newBoard.every(Boolean)) {
          setPhase("draw");
          return;
        }

        setCurrentPlayer("X");
        setTimerKey("t" + Date.now());
      }
    }, thinkingTime);

    return () => clearTimeout(timer);
  }, [gameMode, phase, currentPlayer, board, playPop]);

  // Tick sounds synced to timer (Only local, online receives tick sync via server notifications)
  useEffect(() => {
    if (phase !== "playing") return;
    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      if (ticks < 3) playTick();
      else if (ticks === 3) playTimerWarning();
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerKey, phase]);

  // Request Wake Lock during gameplay, release afterwards
  useEffect(() => {
    if (phase === "playing") {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [phase, requestWakeLock, releaseWakeLock]);

  // Socket online room listeners
  useEffect(() => {
    if (!socket || gameMode !== "online") return;

    socket.on("match_found", (data: { roomId: string, opponent: any, role: Player, stake: number }) => {
      setIsSearching(false);
      setIsPrivateLobby(false);
      setPrivateLobbyStatus("ready");
      setMyRole(data.role);
      setOpponentProfile(data.opponent);
      setCurrentStake(data.stake);
      setBoard(Array(9).fill(null));
      setCurrentPlayer("X");
      setPhase("playing");
      setWinResult(null);
      setTimerKey("t" + Date.now());
      setRewardGiven(false);
    });

    socket.on("state_sync", (data: { board: Cell[], currentPlayer: Player, expiredPlayer?: Player }) => {
      setBoard(data.board);
      setCurrentPlayer(data.currentPlayer);
      setTimerKey("t" + Date.now());
      playPop();

      if (data.expiredPlayer && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    });

    socket.on("opponent_emote", (data: { emoji: string, senderSocketId: string }) => {
      playEmote();
      const id = emoteId.current++;
      const x = 50 + (Math.random() - 0.5) * 120;
      const y = window.innerHeight * 0.45 + Math.random() * 80;
      setFloatingEmotes((prev) => [...prev.slice(-5), { id, emoji: data.emoji, x, y }]);
      setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 1300);
    });

    socket.on("game_over", (data: { board: Cell[], winner: Player | null, isDraw: boolean, winningLine?: number[], reward: number, token?: string }) => {
      setBoard(data.board);
      setWinResult(data.winner ? { winner: data.winner, line: data.winningLine || [] } : null);
      setPhase(data.isDraw ? "draw" : "won");
      
      if (data.isDraw) {
        playLose();
        return;
      }

      if (data.token && !rewardGiven && data.winner === myRole) {
        addCoins(data.reward);
        playWin();
        setRewardGiven(true);
      } else {
        playLose();
      }
    });

    socket.on("opponent_left", (data: { winner: Player, reward: number, token: string }) => {
      setWinResult({ winner: data.winner, line: [] });
      setPhase("won");
      
      if (data.token && !rewardGiven && data.winner === myRole) {
        addCoins(data.reward);
        playWin();
        setRewardGiven(true);
      }
    });

    // Listen to private lobby state changes
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
      socket.off("state_sync");
      socket.off("opponent_emote");
      socket.off("game_over");
      socket.off("opponent_left");
      socket.off("private_room_status");
    };
  }, [socket, gameMode, myRole, rewardGiven, addCoins, playPop, playWin, playLose, playEmote]);

  const startGame = (stake = BASE_REWARD) => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer("X");
    setPhase("playing");
    setWinResult(null);
    setTimerKey("t" + Date.now());
    setRewardGiven(false);
    setCurrentStake(stake);
    setShowDoubleModal(false);
    setPendingRematch(false);
  };

  const handleTimeExpire = useCallback(() => {
    if (phase !== "playing") return;
    if (gameMode === "online") return; // Handled by server timer
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setCurrentPlayer((prev) => (prev === "X" ? "O" : "X"));
    setTimerKey("t" + Date.now());
  }, [phase, gameMode]);

  const handleCellClick = (index: number) => {
    if (phase !== "playing" || board[index]) return;

    if (gameMode === "online") {
      if (myRole !== currentPlayer) return;
      emitAction("make_move", { cellIndex: index });
      return;
    }

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);
    playPop();

    const result = checkWinner(newBoard);
    if (result) { setWinResult(result); setPhase("won"); return; }
    if (newBoard.every(Boolean)) { setPhase("draw"); return; }

    setCurrentPlayer((prev) => (prev === "X" ? "O" : "X"));
    setTimerKey("t" + Date.now());
  };

  const handleSendEmote = (emoji: string) => {
    playEmote();
    if (navigator.vibrate) navigator.vibrate([30]);

    if (gameMode === "online") {
      emitAction("send_emote", { emoji });
    }

    const id = emoteId.current++;
    const x = 50 + (Math.random() - 0.5) * 120;
    const y = window.innerHeight * 0.5 + Math.random() * 80;
    setFloatingEmotes((prev) => [...prev.slice(-5), { id, emoji, x, y }]);
    setTimeout(() => setFloatingEmotes((prev) => prev.filter((e) => e.id !== id)), 1300);
  };

  const startOnlineMatchmaking = () => {
    setGameMode("online");
    setIsSearching(true);
    setIsPrivateLobby(false);
    setRewardGiven(false);
    setMyRole(null);
    setOpponentProfile(null);
    
    findMatch("xo", {
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

    joinPrivateRoom("create", "xo", "", {
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

    joinPrivateRoom("join", "xo", code.toUpperCase(), {
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

  // Rematch flow
  const handleRematchClick = () => {
    if (gameMode === "online") {
      startOnlineMatchmaking();
      return;
    }
    setPendingRematch(true);
    setShowDoubleModal(true);
  };

  const handleDoubleAccept = () => {
    startGame(currentStake * 2);
  };

  const handleDoubleDecline = () => {
    startGame(BASE_REWARD);
  };

  // Render glowing offscreen HTML Canvas 2D score card and share natively
  const handleShareScorecard = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw glowing Cyberpunk Dark radial background
    const grad = ctx.createRadialGradient(300, 300, 50, 300, 300, 450);
    grad.addColorStop(0, "#13132b");
    grad.addColorStop(1, "#06060f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 600);

    // Neon Cyan Grid overlay
    ctx.strokeStyle = "rgba(0, 243, 255, 0.05)";
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

    // Neon Pink side glows
    ctx.fillStyle = "rgba(255, 0, 240, 0.04)";
    ctx.beginPath();
    ctx.arc(0, 300, 160, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0, 243, 255, 0.04)";
    ctx.beginPath();
    ctx.arc(600, 300, 160, 0, Math.PI * 2);
    ctx.fill();

    // 2. Mini Clash Neon Header
    ctx.fillStyle = "#00f3ff";
    ctx.font = "900 48px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MINI CLASH", 300, 90);

    ctx.fillStyle = "#ffea00";
    ctx.font = "bold 16px Rajdhani, sans-serif";
    ctx.fillText("⚡ MULTIPLAYER ARCADE SOCIAL HUB ⚡", 300, 125);

    // 3. Central card border
    ctx.fillStyle = "rgba(13, 13, 26, 0.9)";
    ctx.strokeStyle = "rgba(0, 243, 255, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(80, 160, 440, 340, 24);
    ctx.fill();
    ctx.stroke();

    // Game Title details
    ctx.fillStyle = "#ff00f0";
    ctx.font = "900 24px Orbitron, sans-serif";
    ctx.fillText("NEON XO SPEEDRUN BATTLE", 300, 215);

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
    ctx.font = "900 36px Orbitron, sans-serif";
    if (phase === "draw") {
      ctx.fillStyle = "#ffea00";
      ctx.fillText("MATCH DRAW!", 300, 390);
    } else {
      const weWon = winResult?.winner === myRole;
      ctx.fillStyle = weWon ? "#00ff88" : "#ff4444";
      ctx.fillText(weWon ? "YOU WON! 🏆" : "RIVAL WON! 💀", 300, 390);
    }

    // Bounty Coins
    if (phase !== "draw" && winResult?.winner === myRole) {
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
            text: "I just dominated in Mini Clash Speedrun! Battle me online with this invite link!",
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

  const winningLine = winResult?.line ?? [];
  const pLink = typeof window !== "undefined" ? `${window.location.origin}/games/xo?room=${privateRoomCode}` : "";

  return (
    <div className="relative min-h-dvh max-w-md mx-auto overflow-x-hidden w-full flex flex-col justify-between bg-[#06060f]"
      style={{
        backgroundImage: `
          linear-gradient(${arena.bgGridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${arena.bgGridColor} 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px"
      }}>
      <FloatingEmoteLayer emotes={floatingEmotes} />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-2">
        <Link href="/" onClick={() => { if (gameMode === "online") leaveMatch(); }} className="glass-card rounded-xl p-2.5 border border-[#1e1e40] hover:border-[#ffea0022] transition-colors btn-press" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={arena.colorPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black uppercase leading-none" style={{ fontFamily: "var(--font-display)", color: arena.colorPrimary, textShadow: `0 0 10px ${arena.colorPrimary}` }}>
            Neon XO Speedrun
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {gameMode === "online" ? "🌐 Real-Time Online" : gameMode === "bot" ? "🤖 vs Smart Bot" : "📱 2P Pass & Play"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase">Prize</p>
          <p className="text-[#ffea00] font-bold text-sm coin-glow">🪙 +{currentStake}</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] gap-5 justify-center">

        {/* ── WebRTC Voice Chat Hud HUD overlay during gameplay ── */}
        {phase === "playing" && gameMode === "online" && (
          <div className="animate-slide-up flex items-center justify-between glass-card rounded-2xl border border-[#1e1e40] p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎙️</span>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">Voice Chat</p>
                <p className={`text-xs font-bold leading-none mt-1 ${voiceActive ? "text-[#00ff88]" : "text-gray-400"}`}>
                  {voiceActive ? `ACTIVE · ${peerState.toUpperCase()}` : "MUTED"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleVoiceChat}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all btn-press border ${
                voiceActive 
                  ? "bg-[#ff004015] border-[#ff004044] text-[#ff0040]" 
                  : "bg-[#00ff8815] border-[#00ff8844] text-[#00ff88]"
              }`}
            >
              {voiceActive ? "MUTE" : "UNMUTE"}
            </button>
          </div>
        )}

        {/* ── Turn indicator ── */}
        {phase === "playing" && (
          <div className="animate-slide-up">
            <div className={`glass-card rounded-2xl border p-4 text-center transition-all duration-300 ${currentPlayer === "X" ? "border-[#00f3ff44]" : "border-[#ff00f044]"}`}
              style={{ boxShadow: currentPlayer === "X" ? "0 0 20px #00f3ff22" : "0 0 20px #ff00f022" }}>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
                {gameMode === "online" && myRole === currentPlayer ? "🚨 YOUR TURN!" : "Current Turn"}
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl" style={{ filter: `drop-shadow(0 0 8px ${currentPlayer === "X" ? skin.colorX : skin.colorO})` }}>
                  {currentPlayer === "X" ? skin.xMark : skin.oMark}
                </span>
                <p className="text-2xl font-black" style={{
                  fontFamily: "var(--font-display)",
                  color: currentPlayer === "X" ? skin.colorX : skin.colorO,
                  textShadow: `0 0 15px ${currentPlayer === "X" ? skin.colorX : skin.colorO}`,
                }}>
                  {gameMode === "online" 
                    ? (myRole === currentPlayer ? "You" : (opponentProfile?.name || "Rival"))
                    : gameMode === "bot"
                    ? (currentPlayer === "X" ? "You" : "Smart Bot 🤖")
                    : `Player ${currentPlayer === "X" ? "1" : "2"}`
                  }
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-gray-600 mb-1 uppercase tracking-widest">
                <span>Timer</span><span>3s</span>
              </div>
              <TimerBar key={timerKey} active={phase === "playing"} onExpire={handleTimeExpire} arena={arena} />
            </div>
          </div>
        )}

        {/* ── Matchmaking Loader / Waiting Queue ── */}
        {phase === "idle" && isSearching && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-4 border-t-[#00f3ff] border-[#1e1e40] animate-spin mx-auto mb-4" style={{ borderTopColor: arena.colorPrimary }} />
              <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: arena.colorPrimary, textShadow: `0 0 10px ${arena.colorPrimary}` }}>LOBBY QUEUE</h2>
              <p className="text-gray-400 mt-2 text-sm max-w-xs mx-auto">
                Finding a worthy opponent online...
              </p>
              <p className="text-[#ff00f0] text-xs font-bold mt-4 animate-pulse uppercase tracking-wider" style={{ color: arena.colorSecondary }}>
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
              <span className="text-6xl mb-3 animate-float block">👥</span>
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
                    const inviteUrl = `${window.location.origin}/games/xo?room=${privateRoomCode}`;
                    navigator.clipboard.writeText(inviteUrl);
                    alert("Invite link copied to clipboard!");
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold uppercase border border-[#00f3ff44] text-[#00f3ff] bg-[#00f3ff0a] btn-press"
                  style={{ borderColor: `${arena.colorPrimary}44`, color: arena.colorPrimary }}
                >
                  🔗 COPY INVITE LINK
                </button>
                {/* WhatsApp button */}
                <button
                  onClick={() => {
                    const inviteUrl = `${window.location.origin}/games/xo?room=${privateRoomCode}`;
                    const whatsappUrl = `https://api.whatsapp.com/send?text=Battle%20me%20in%20Mini%20Clash!%20Click%20here%20to%20join%20my%20private%20lobby:%20${encodeURIComponent(inviteUrl)}`;
                    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="w-full py-3 rounded-xl text-xs font-black uppercase text-[#06060f] tracking-wider text-center btn-press flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: "#25d366" }}
                >
                  💬 WHATSAPP SHARE
                </button>
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

        {/* ── Private invite Lobby ready / joining queue overlay ── */}
        {phase === "idle" && isPrivateLobby && privateLobbyStatus === "ready" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-4 border-t-[#00f3ff] border-[#1e1e40] animate-spin mx-auto mb-4" style={{ borderTopColor: arena.colorPrimary }} />
              <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: arena.colorPrimary, textShadow: `0 0 10px ${arena.colorPrimary}` }}>JOINING LOBBY</h2>
              <p className="text-gray-400 mt-2 text-sm max-w-xs mx-auto">
                Connecting to friend's private lobby...
              </p>
            </div>
            <button
              className="w-full max-w-xs py-3 rounded-xl font-bold uppercase tracking-wider text-xs btn-press border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
              onClick={cancelMatchmaking}
            >
              ❌ CANCEL
            </button>
          </div>
        )}

        {/* ── Idle / Mode Selection Screen ── */}
        {phase === "idle" && !isSearching && (!isPrivateLobby || privateLobbyStatus === "idle") && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up">
            <div className="text-center">
              <div className="text-8xl mb-4 animate-float">⚡</div>
              <h2 className="text-3xl font-black leading-none" style={{ fontFamily: "var(--font-display)", color: arena.colorPrimary, textShadow: `0 0 10px ${arena.colorPrimary}` }}>XO SPEEDRUN</h2>
              <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-xs mx-auto">
                Tic-Tac-Toe speed war. Only <span className="font-bold animate-pulse" style={{ color: arena.colorSecondary }}>3 seconds</span> per turn!
              </p>
              {selectedXOSkin !== "default_xo" && (
                <p className="text-xs text-[#ffea00] mt-3 font-bold">Using: {skin.name} skin ✨</p>
              )}
            </div>

            <div className="w-full flex flex-col gap-3 px-4">
              <button id="xo-start-online-btn"
                className="w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest text-[#06060f] btn-press"
                style={{ background: `linear-gradient(135deg, ${arena.colorPrimary}, ${arena.colorSecondary})`, boxShadow: `0 0 30px ${arena.colorPrimary}55` }}
                onClick={startOnlineMatchmaking}>
                🌐 MATCHMAKING (RANDOM)
              </button>

              <button id="xo-private-lobby-btn"
                className="w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest text-[#e8e8ff] glass-card border border-[#ffea0033] hover:bg-[#ffea0008] transition-all btn-press"
                style={{ borderColor: `${arena.colorSecondary}33` }}
                onClick={startPrivateFriendLobby}>
                👥 PLAY WITH FRIEND (PRIVATE)
              </button>
              
              <button id="xo-start-bot-btn"
                className="w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest text-[#06060f] btn-press"
                style={{ background: `linear-gradient(135deg, ${arena.colorPrimary}, ${arena.colorSecondary})`, boxShadow: `0 0 30px ${arena.colorPrimary}55` }}
                onClick={() => { setGameMode("bot"); startGame(); }}>
                🤖 PLAY VS BOT (1P)
              </button>

              <button id="xo-start-local-btn"
                className="w-full py-4 rounded-2xl font-bold text-lg uppercase tracking-widest text-gray-400 glass-card border border-[#1e1e40] hover:border-[#00f3ff22] transition-all btn-press"
                style={{ borderColor: `${arena.colorPrimary}33` }}
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
                    id="code-input-box"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById("code-input-box") as HTMLInputElement;
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

        {/* ── Board ── */}
        {(phase === "playing" || phase === "won" || phase === "draw") && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-3 gap-3 w-full aspect-square max-w-[340px] mx-auto">
              {board.map((cell, i) => (
                <XOCell
                  key={i}
                  value={cell}
                  index={i}
                  onClick={() => handleCellClick(i)}
                  isWinning={winningLine.includes(i)}
                  disabled={phase !== "playing" || !!cell || (gameMode === "online" && myRole !== currentPlayer) || (gameMode === "bot" && currentPlayer === "O")}
                  skin={skin}
                  arena={arena}
                />
              ))}
            </div>
            
            {/* Player details */}
            <div className="flex justify-between mt-6 px-2">
              <div className="flex items-center gap-2">
                <span style={{ color: skin.colorX, filter: `drop-shadow(0 0 6px ${skin.colorX})` }}>{skin.xMark}</span>
                <span className="text-xs text-gray-500 font-bold">
                  {gameMode === "online" 
                    ? (myRole === "X" ? "You (P1)" : "Rival (P1)")
                    : gameMode === "bot"
                    ? "You (P1)"
                    : "Player 1"
                  }
                </span>
              </div>
              <div className="w-px" style={{ backgroundColor: `${arena.colorPrimary}22` }} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-bold">
                  {gameMode === "online"
                    ? (myRole === "O" ? "You (P2)" : "Rival (P2)")
                    : gameMode === "bot"
                    ? "Smart Bot (P2)"
                    : "Player 2"
                  }
                </span>
                <span style={{ color: skin.colorO, filter: `drop-shadow(0 0 6px ${skin.colorO})` }}>{skin.oMark}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Emote bar (during play) ── */}
      {phase === "playing" && <EmoteBar emotes={activeEmotes} onSend={handleSendEmote} />}

      {/* ── Winner Modal ── */}
      {(phase === "won" || phase === "draw") && !showDoubleModal && (
        <WinnerModal
          winner={winResult?.winner ?? null}
          isDraw={phase === "draw"}
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

      {/* ── Double or Nothing Modal ── */}
      {showDoubleModal && pendingRematch && (
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

export default function XOSpeedrunPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh max-w-md mx-auto bg-[#06060f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-[#00f3ff] border-[#1e1e40] rounded-full animate-spin"></div>
      </div>
    }>
      <XOSpeedrunInner />
    </Suspense>
  );
}
