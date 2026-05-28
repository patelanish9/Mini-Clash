"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";

/* ─────────────────────────────────────────────────────────────
   WorldChat — Live ephemeral hub chat via Socket.IO
   All messages are server-side in-memory (last 50 messages).
   No database required.
───────────────────────────────────────────────────────────── */

export interface ChatMessage {
  id: string;
  text: string;
  avatarEmoji: string;
  playerName: string;
  rankIcon: string;
  timestamp: number;
}

interface WorldChatProps {
  avatarEmoji: string;
  playerName: string;
  rankIcon: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function WorldChat({ avatarEmoji, playerName, rankIcon }: WorldChatProps) {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for chat events
  useEffect(() => {
    if (!socket) return;

    const onHistory = (history: ChatMessage[]) => {
      setMessages(history);
    };

    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        // Deduplicate (server might echo back)
        if (prev.some((m) => m.id === msg.id)) return prev;
        const next = [...prev, msg];
        return next.slice(-50); // keep max 50 in state
      });
    };

    socket.on("chat_history", onHistory);
    socket.on("chat_message", onMessage);

    return () => {
      socket.off("chat_history", onHistory);
      socket.off("chat_message", onMessage);
    };
  }, [socket]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !socket || !connected || isSending) return;

    setIsSending(true);
    socket.emit("chat_message", {
      text,
      avatarEmoji,
      playerName,
      rankIcon,
    });
    setInput("");
    setTimeout(() => setIsSending(false), 500);
  }, [input, socket, connected, isSending, avatarEmoji, playerName, rankIcon]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <section
      className="glass-card rounded-2xl border border-[#ff00f022] animate-slide-up"
      style={{ animationDelay: "0.35s", boxShadow: "0 0 20px #ff00f008" }}
      aria-label="World Chat"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#1e1e40]">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <div>
            <h3
              className="text-xs font-black uppercase tracking-widest text-[#ff00f0]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              World Chat
            </h3>
            <p className="text-[9px] text-gray-600 uppercase tracking-wider">
              Live • Ephemeral
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00ff88]" : "bg-red-500"}`}
            style={{ boxShadow: connected ? "0 0 4px #00ff88" : "none" }}
          />
          <span className="text-[9px] text-gray-600 uppercase tracking-wider">
            {connected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Message List */}
      <div
        ref={listRef}
        className="overflow-y-auto px-3 py-2 space-y-2"
        style={{ maxHeight: "180px", minHeight: "96px" }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 gap-1">
            <span className="text-2xl opacity-20">💬</span>
            <p className="text-[10px] text-gray-700 uppercase tracking-wider">
              {connected ? "No messages yet — say hi!" : "Connecting…"}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.playerName === playerName && msg.avatarEmoji === avatarEmoji;
            return (
              <div key={msg.id} className={`flex gap-2 items-start ${isMe ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-sm flex-shrink-0 border bg-[#0d0d1a]"
                  style={{ borderColor: "#1e1e40" }}
                >
                  {msg.avatarEmoji}
                </div>

                {/* Bubble */}
                <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px]">{msg.rankIcon}</span>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider"
                      style={{ color: isMe ? "#00f3ff" : "#ff00f0" }}
                    >
                      {isMe ? "You" : msg.playerName}
                    </span>
                    <span className="text-[8px] text-gray-700">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] leading-snug ${
                      isMe
                        ? "bg-[#00f3ff15] border border-[#00f3ff22] text-[#e8e8ff]"
                        : "bg-[#ff00f010] border border-[#ff00f022] text-[#e8e8ff]"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-2 border-t border-[#1e1e40]">
        <input
          ref={inputRef}
          id="world-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!connected}
          maxLength={120}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          className="flex-1 bg-[#0d0d1a] border border-[#1e1e40] rounded-xl px-3 py-2 text-[11px] text-[#e8e8ff] placeholder-gray-700 outline-none focus:border-[#ff00f044] transition-colors"
        />
        <button
          id="world-chat-send-btn"
          onClick={sendMessage}
          disabled={!connected || !input.trim() || isSending}
          className="w-8 h-8 rounded-xl flex items-center justify-center btn-press transition-all disabled:opacity-30"
          style={{
            background: "linear-gradient(135deg, #ff00f0, #00f3ff)",
            boxShadow: connected && input.trim() ? "0 0 10px #ff00f055" : "none",
          }}
          aria-label="Send message"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 6h10M7 2l4 4-4 4" stroke="#06060f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}
