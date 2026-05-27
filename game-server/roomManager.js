// Server-side Matchmaking & Private Lobbies Room Manager

import { initXOGame, handleXOMove, handleXODisconnect, cleanXOGame } from "./xoGame.js";
import { initRageTapGame, handleRageTap, handleRageDisconnect, cleanRageGame } from "./rageTapGame.js";

// Queues for each game (Human matchmaking)
const queues = {
  xo: [],
  rage: []
};

// Maps socketId -> { roomId, gameType, opponentBot? }
export const activeSockets = new Map();

// Map to store matchmaking fallback timers: socketId -> Timer
const matchmakingTimers = new Map();

// Map to store private friend rooms: roomCode -> { gameType, p1: player, p2: null }
const privateRooms = new Map();

// Counter for global active matchmaking/players
export function getActiveStats() {
  return {
    waitingXOPayers: queues.xo.length,
    waitingRagePlayers: queues.rage.length,
    activeMatchesCount: activeSockets.size / 2
  };
}

export function handleFindMatch(io, socket, { gameType, profile }) {
  const socketId = socket.id;

  // Clean up any old active matches or queues this socket was in
  handleDisconnectOrLeave(io, socket);

  // Validate game type
  if (gameType !== "xo" && gameType !== "rage-tap") {
    return;
  }

  const queueKey = gameType === "xo" ? "xo" : "rage";
  const player = {
    socketId,
    profile: {
      name: profile?.name || "Anonymous Gamer",
      avatarEmoji: profile?.avatarEmoji || "🎮",
      avatarGlowColor: profile?.avatarGlowColor || "#00f3ff"
    }
  };

  // Add to queue
  queues[queueKey].push(player);

  // If player is the first in queue, start 10s Fallback AI Bot timer
  if (queues[queueKey].length === 1) {
    const timer = setTimeout(() => {
      triggerAIBotFallback(io, socket, gameType, player);
    }, 10000); // 10 seconds empty lobby trigger
    matchmakingTimers.set(socketId, timer);
  }

  // Check if we have a match
  if (queues[queueKey].length >= 2) {
    // Pair two real humans
    const p1 = queues[queueKey].shift();
    const p2 = queues[queueKey].shift();

    // Clear bot timers for both
    clearBotTimer(p1.socketId);
    clearBotTimer(p2.socketId);

    const roomId = `room_${gameType}_${Math.random().toString(36).substring(2, 9)}`;

    // Join sockets to the Socket.io room
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);

    if (s1 && s2) {
      s1.join(roomId);
      s2.join(roomId);

      // Register active socket mappings
      activeSockets.set(p1.socketId, { roomId, gameType });
      activeSockets.set(p2.socketId, { roomId, gameType });

      const stake = gameType === "xo" ? 50 : 100;

      // Initialize the specific game engine
      if (gameType === "xo") {
        initXOGame(io, roomId, p1, p2, stake);
      } else {
        initRageTapGame(io, roomId, p1, p2, stake);
      }
    } else {
      // If one of the sockets is dead, put the other back in queue
      if (s1) queues[queueKey].unshift(p1);
      if (s2) queues[queueKey].unshift(p2);
    }
  }

  // Broadcast matchmaking update
  broadcastStats(io);
}

function clearBotTimer(socketId) {
  if (matchmakingTimers.has(socketId)) {
    clearTimeout(matchmakingTimers.get(socketId));
    matchmakingTimers.delete(socketId);
  }
}

// Spawns a fallback AI bot when matchmaking exceeds 10 seconds
function triggerAIBotFallback(io, socket, gameType, humanPlayer) {
  const socketId = socket.id;
  clearBotTimer(socketId);

  // Remove from human queue
  const queueKey = gameType === "xo" ? "xo" : "rage";
  queues[queueKey] = queues[queueKey].filter(p => p.socketId !== socketId);

  // Create Bot profile
  const botPlayer = {
    socketId: `bot_${Math.random().toString(36).substring(2, 6)}`,
    profile: {
      name: "Cyber Bot AI",
      avatarEmoji: "🤖",
      avatarGlowColor: "#ff00f0"
    },
    isBot: true
  };

  const roomId = `room_bot_${gameType}_${Math.random().toString(36).substring(2, 9)}`;
  socket.join(roomId);

  // Map human to room and flag opponent as a Bot
  activeSockets.set(socketId, { roomId, gameType, opponentBot: botPlayer });

  const stake = gameType === "xo" ? 50 : 100;

  console.log(`🤖 [AI Fallback Triggered] human ${humanPlayer.profile.name} matched with Bot in room ${roomId}`);

  if (gameType === "xo") {
    initXOGame(io, roomId, humanPlayer, botPlayer, stake);
  } else {
    initRageTapGame(io, roomId, humanPlayer, botPlayer, stake);
  }

  broadcastStats(io);
}

// Handle Private Codes Lobbies ("Play with Friend")
export function handlePrivateRoom(io, socket, { action, gameType, roomCode, profile }) {
  const socketId = socket.id;

  // Clean old active connections
  handleDisconnectOrLeave(io, socket);

  const player = {
    socketId,
    profile: {
      name: profile?.name || "Anonymous Friend",
      avatarEmoji: profile?.avatarEmoji || "🎭",
      avatarGlowColor: profile?.avatarGlowColor || "#ffea00"
    }
  };

  const code = roomCode?.toUpperCase();

  if (action === "create") {
    // Generate a unique 4-digit code if not supplied
    const generatedCode = code || Math.random().toString(36).substring(2, 6).toUpperCase();
    const roomId = `room_private_${generatedCode}`;

    socket.join(roomId);
    privateRooms.set(generatedCode, {
      gameType,
      roomId,
      p1: player,
      p2: null
    });

    socket.emit("private_room_status", {
      action: "create",
      roomCode: generatedCode,
      status: "waiting"
    });

    console.log(`🔑 [Private Room Created] Code: ${generatedCode} | Host: ${player.profile.name}`);
  } 
  
  else if (action === "join") {
    if (!privateRooms.has(code)) {
      socket.emit("private_room_status", {
        action: "join",
        status: "error",
        message: "Room Code not found! Please check and try again."
      });
      return;
    }

    const room = privateRooms.get(code);
    if (room.p2 !== null) {
      socket.emit("private_room_status", {
        action: "join",
        status: "error",
        message: "Room is already full!"
      });
      return;
    }

    // Join P2 to private room
    const roomId = room.roomId;
    socket.join(roomId);
    room.p2 = player;

    // Register active mapping for socket.io triggers
    activeSockets.set(room.p1.socketId, { roomId, gameType: room.gameType });
    activeSockets.set(player.socketId, { roomId, gameType: room.gameType });

    socket.emit("private_room_status", {
      action: "join",
      status: "ready"
    });

    console.log(`🔑 [Private Room Joined] Code: ${code} | P2: ${player.profile.name} connected to P1: ${room.p1.profile.name}`);

    // Remove from active code directory to clean resources
    privateRooms.delete(code);

    const stake = room.gameType === "xo" ? 50 : 100;

    // Start private multiplayer match
    if (room.gameType === "xo") {
      initXOGame(io, roomId, room.p1, player, stake);
    } else {
      initRageTapGame(io, roomId, room.p1, player, stake);
    }
  }
}

export function handleClientAction(io, socket, { action, payload }) {
  const socketId = socket.id;
  const mapping = activeSockets.get(socketId);
  if (!mapping) return;

  const { roomId, gameType } = mapping;

  if (action === "webrtc_signal") {
    // Relays low-latency audio stream negotiation packets (offers/answers/ice candidates)
    socket.broadcast.to(roomId).emit("webrtc_signal", payload);
    return;
  }

  if (gameType === "xo") {
    if (action === "make_move") {
      handleXOMove(io, roomId, socketId, payload.cellIndex);
    } else if (action === "send_emote") {
      // Broadcast emote to opponent in the room
      io.to(roomId).emit("opponent_emote", {
        emoji: payload.emoji,
        senderSocketId: socketId
      });
    }
  } else if (gameType === "rage-tap") {
    if (action === "submit_taps") {
      handleRageTap(io, roomId, socketId, payload.tapCount);
    } else if (action === "send_emote") {
      io.to(roomId).emit("opponent_emote", {
        emoji: payload.emoji,
        senderSocketId: socketId
      });
    }
  }
}

export function handleDisconnectOrLeave(io, socket) {
  const socketId = socket.id;
  clearBotTimer(socketId);

  // Remove from human queues
  for (const key of Object.keys(queues)) {
    queues[key] = queues[key].filter(player => player.socketId !== socketId);
  }

  // Remove from private codes waiting lobbies
  for (const [code, room] of privateRooms.entries()) {
    if (room.p1.socketId === socketId) {
      privateRooms.delete(code);
    }
  }

  // Check active matches
  const mapping = activeSockets.get(socketId);
  if (mapping) {
    const { roomId, gameType } = mapping;
    activeSockets.delete(socketId);

    // Call specific game disconnect declarations
    if (gameType === "xo") {
      handleXODisconnect(io, roomId, socketId);
      cleanRoomMappings(roomId);
    } else if (gameType === "rage-tap") {
      handleRageDisconnect(io, roomId, socketId);
      cleanRoomMappings(roomId);
    }
  }

  broadcastStats(io);
}

function cleanRoomMappings(roomId) {
  for (const [sId, mapping] of activeSockets.entries()) {
    if (mapping.roomId === roomId) {
      activeSockets.delete(sId);
    }
  }
}

export function broadcastStats(io) {
  const stats = {
    onlinePlayers: io.sockets.sockets.size,
    waitingPlayers: queues.xo.length + queues.rage.length + privateRooms.size,
    activeMatches: activeSockets.size / 2
  };
  io.emit("stats_update", stats);
}
