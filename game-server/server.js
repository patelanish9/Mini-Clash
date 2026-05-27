// Standalone Node.js Game Server for Mini Clash — Neon Real-Time Multiplayer
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  handleFindMatch,
  handlePrivateRoom,
  handleClientAction,
  handleDisconnectOrLeave,
  broadcastStats
} from "./roomManager.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Basic CORS setup for the health checker and potential API upgrades
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(express.json());

// Live check endpoint for hosting platforms (Render, Railway, Fly.io)
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

const httpServer = createServer(app);

// Initialize Socket.io with open CORS so frontend on Vercel can connect seamlessly
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 10000, // Frequent pings to keep Heroku/Render connections alive
  pingTimeout: 5000
});

io.on("connection", (socket) => {
  console.log(`[Socket Connected] Client ID: ${socket.id}`);
  
  // Immediately sync current online stats to the new client
  broadcastStats(io);

  // Player triggers matchmaking
  socket.on("find_match", (data) => {
    handleFindMatch(io, socket, data);
  });

  // Player creates/joins private friend lobby
  socket.on("join_private_room", (data) => {
    handlePrivateRoom(io, socket, data);
  });

  // Player sends a gameplay move, tap batch, emote, or WebRTC signaling data
  socket.on("player_action", (data) => {
    handleClientAction(io, socket, data);
  });

  // Explicit match leave
  socket.on("leave_match", () => {
    handleDisconnectOrLeave(io, socket);
  });

  // Unexpected disconnect (close browser, lost cell signal, etc.)
  socket.on("disconnect", () => {
    console.log(`[Socket Disconnected] Client ID: ${socket.id}`);
    handleDisconnectOrLeave(io, socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`⚡ Mini Clash Game Server Running on Port: ${PORT}`);
  console.log(`🔌 WebSockets Active & Listening...`);
  console.log(`===============================================`);
});
