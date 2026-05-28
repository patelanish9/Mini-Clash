import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import next from "next";
import {
  handleFindMatch,
  handlePrivateRoom,
  handleClientAction,
  handleDisconnectOrLeave,
  broadcastStats
} from "./game-server/roomManager.js";

const dev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3000;

// ── World Chat (ephemeral, in-memory, last 50 messages) ──
const MAX_CHAT_MESSAGES = 50;
const worldChatHistory = [];

// Initialize Next.js app
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();

  // Basic CORS setup for health and sockets
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
  }));

  app.use(express.json());

  // Health endpoint for Render/Railway checkers
  app.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date() });
  });

  const httpServer = createServer(app);

  // Initialize Socket.io on the same HTTP server
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingInterval: 10000, // Frequent ping checks to keep persistent connections active
    pingTimeout: 5000
  });

  io.on("connection", (socket) => {
    console.log(`[Socket Connected] Client ID: ${socket.id}`);
    
    // Immediately sync active lobbies and online player stats to the client
    broadcastStats(io);

    // Send chat history to the newly connected client
    socket.emit("chat_history", worldChatHistory);

    // Receive & broadcast a new world chat message
    socket.on("chat_message", (data) => {
      const { text, avatarEmoji, playerName, rankIcon } = data;
      if (!text || typeof text !== "string") return;
      const sanitized = text.trim().slice(0, 120); // cap length
      if (!sanitized) return;

      const msg = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: sanitized,
        avatarEmoji: avatarEmoji || "🎮",
        playerName: (playerName || "Anon").slice(0, 20),
        rankIcon: rankIcon || "🥉",
        timestamp: Date.now(),
      };

      worldChatHistory.push(msg);
      if (worldChatHistory.length > MAX_CHAT_MESSAGES) {
        worldChatHistory.shift();
      }

      io.emit("chat_message", msg);
    });

    // Human matchmaking triggers
    socket.on("find_match", (data) => {
      handleFindMatch(io, socket, data);
    });

    // Create or Join private friend rooms
    socket.on("join_private_room", (data) => {
      handlePrivateRoom(io, socket, data);
    });

    // Game action (turns, moves, taps, emotes, WebRTC signals)
    socket.on("player_action", (data) => {
      handleClientAction(io, socket, data);
    });

    // Clean leaving lobby match
    socket.on("leave_match", () => {
      handleDisconnectOrLeave(io, socket);
    });

    // Unexpected connection loss
    socket.on("disconnect", () => {
      console.log(`[Socket Disconnected] Client ID: ${socket.id}`);
      handleDisconnectOrLeave(io, socket);
    });
  });

  // Delegate all standard routes to Next.js handler
  app.all("*", (req, res) => {
    return nextHandler(req, res);
  });

  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`===============================================`);
    console.log(`⚡ Mini Clash Unified Server Running on Port: ${PORT}`);
    console.log(`🔌 WebSockets & Next.js Pages Active Together!`);
    console.log(`===============================================`);
  });
});
