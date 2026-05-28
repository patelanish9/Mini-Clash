"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

/* ─────────────────────────────────────────────────────────────
   useSocket — Reusable hook for real-time multiplayer connections
   Tracks connection state, lobbies stats, and exposes dispatchers
───────────────────────────────────────────────────────────── */

export interface ServerStats {
  onlinePlayers: number;
  waitingPlayers: number;
  activeMatches: number;
}

const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<ServerStats>({
    onlinePlayers: 0,
    waitingPlayers: 0,
    activeMatches: 0,
  });

  useEffect(() => {
    // Lazy initialize socket connection to prevent Next.js SSR mismatch
    if (typeof window === "undefined") return;

    const socket = io(SERVER_URL, {
      autoConnect: true,
      transports: ["polling", "websocket"], // Allow polling fallback for stable handshake on deployed servers
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("stats_update", (serverStats: ServerStats) => {
      setStats(serverStats);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const findMatch = (gameType: "xo" | "rage-tap", profile: { name: string; avatarEmoji: string; avatarGlowColor: string }) => {
    if (!socketRef.current || !connected) return;
    socketRef.current.emit("find_match", { gameType, profile });
  };

  const leaveMatch = () => {
    if (!socketRef.current || !connected) return;
    socketRef.current.emit("leave_match");
  };

  const emitAction = (action: string, payload: any) => {
    if (!socketRef.current || !connected) return;
    socketRef.current.emit("player_action", { action, payload });
  };

  const joinPrivateRoom = (
    action: "create" | "join",
    gameType: "xo" | "rage-tap",
    roomCode: string,
    profile: { name: string; avatarEmoji: string; avatarGlowColor: string }
  ) => {
    if (!socketRef.current || !connected) return;
    socketRef.current.emit("join_private_room", { action, gameType, roomCode, profile });
  };

  return {
    socket: socketRef.current,
    connected,
    stats,
    findMatch,
    leaveMatch,
    emitAction,
    joinPrivateRoom,
  };
}
