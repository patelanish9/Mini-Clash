"use client";

import { useState } from "react";
import Link from "next/link";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useSound } from "@/hooks/useSound";
import {
  XO_SKINS,
  AVATARS,
  EMOTE_PACKS,
  AUDIO_PACKS,
  ARENA_THEMES,
  XOSkin,
  AvatarItem,
  EmotePackItem,
  AudioPackItem,
  ArenaThemeItem,
} from "@/lib/gameStore";

/* ─── Toast notification ─── */
function Toast({ message, type }: { message: string; type: "success" | "error" | "info" }) {
  const colors = {
    success: "border-[#00ff88] text-[#00ff88] bg-[#00ff8815]",
    error:   "border-[#ff4444] text-[#ff4444] bg-[#ff444415]",
    info:    "border-[#00f3ff] text-[#00f3ff] bg-[#00f3ff15]",
  };
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] glass-card rounded-2xl border px-5 py-3 font-bold text-sm animate-pop-in max-w-xs text-center ${colors[type]}`}>
      {message}
    </div>
  );
}

/* ─── XO Skin Card ─── */
function SkinCard({
  skin,
  owned,
  equipped,
  canAfford,
  onBuy,
  onEquip,
}: {
  skin: XOSkin;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <div className={`relative glass-card rounded-2xl border p-4 transition-all duration-200 ${
      equipped ? "border-[#ffea00] glow-yellow" : owned ? "border-[#00ff8844]" : "border-[#1e1e40]"
    }`}>
      {equipped && (
        <div className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-widest text-[#ffea00] bg-[#ffea0015] border border-[#ffea0044] rounded-full px-2 py-0.5">
          Equipped
        </div>
      )}

      {/* Preview */}
      <div className="flex items-center justify-center gap-6 py-4">
        <div className="text-center">
          <div className="text-4xl" style={{ filter: `drop-shadow(0 0 8px ${skin.colorX})` }}>{skin.xMark}</div>
          <p className="text-[10px] text-gray-500 mt-1">P1</p>
        </div>
        <div className="text-gray-600 font-bold">VS</div>
        <div className="text-center">
          <div className="text-4xl" style={{ filter: `drop-shadow(0 0 8px ${skin.colorO})` }}>{skin.oMark}</div>
          <p className="text-[10px] text-gray-500 mt-1">P2</p>
        </div>
      </div>

      <p className="text-white font-black text-center text-base" style={{ fontFamily: "var(--font-display)" }}>{skin.name}</p>
      <p className="text-gray-500 text-xs text-center mt-1 mb-4">{skin.description}</p>

      {skin.cost === 0 || owned ? (
        <button
          id={`equip-skin-${skin.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all btn-press ${
            equipped
              ? "bg-[#ffea0022] border border-[#ffea0044] text-[#ffea00] cursor-default"
              : "border border-[#00ff8844] text-[#00ff88] hover:bg-[#00ff8815]"
          }`}
          onClick={onEquip}
          disabled={equipped}
        >
          {equipped ? "✓ Equipped" : "Equip"}
        </button>
      ) : (
        <button
          id={`buy-skin-${skin.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all btn-press ${
            canAfford
              ? "bg-[#ffea0015] border border-[#ffea0044] text-[#ffea00] hover:bg-[#ffea0025]"
              : "bg-[#1e1e40] border border-[#2a2a50] text-gray-600 cursor-not-allowed"
          }`}
          onClick={onBuy}
          disabled={!canAfford}
        >
          {canAfford ? `🪙 ${skin.cost.toLocaleString()} – Buy` : `🔒 ${skin.cost.toLocaleString()} Coins`}
        </button>
      )}
    </div>
  );
}

/* ─── Avatar Card ─── */
function AvatarCard({
  avatar,
  owned,
  equipped,
  canAfford,
  onBuy,
  onEquip,
}: {
  avatar: AvatarItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <div className={`relative glass-card rounded-2xl border p-4 text-center transition-all duration-200 ${
      equipped ? "border-[#ffea00] glow-yellow" : owned ? "border-[#00ff8844]" : "border-[#1e1e40]"
    }`}>
      {equipped && (
        <div className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-widest text-[#ffea00] bg-[#ffea0015] border border-[#ffea0044] rounded-full px-2 py-0.5">
          Active
        </div>
      )}

      {/* Avatar preview */}
      <div className="relative mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mb-3 border"
        style={{
          borderColor: `${avatar.glowColor}44`,
          background: `radial-gradient(circle, ${avatar.glowColor}15, transparent)`,
          boxShadow: equipped ? `0 0 20px ${avatar.glowColor}66` : `0 0 8px ${avatar.glowColor}22`,
        }}>
        {avatar.emoji}
      </div>

      <p className="text-white font-black text-sm" style={{ fontFamily: "var(--font-display)" }}>{avatar.name}</p>
      <p className="text-gray-500 text-xs mt-1 mb-4">{avatar.description}</p>

      {avatar.cost === 0 || owned ? (
        <button
          id={`equip-avatar-${avatar.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all btn-press ${
            equipped
              ? "bg-[#ffea0022] border border-[#ffea0044] text-[#ffea00] cursor-default"
              : "border border-[#00ff8844] text-[#00ff88] hover:bg-[#00ff8815]"
          }`}
          onClick={onEquip}
          disabled={equipped}
        >
          {equipped ? "✓ Active" : "Equip"}
        </button>
      ) : (
        <button
          id={`buy-avatar-${avatar.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all btn-press ${
            canAfford
              ? "bg-[#ffea0015] border border-[#ffea0044] text-[#ffea00] hover:bg-[#ffea0025]"
              : "bg-[#1e1e40] border border-[#2a2a50] text-gray-600 cursor-not-allowed"
          }`}
          onClick={onBuy}
          disabled={!canAfford}
        >
          {canAfford ? `🪙 ${avatar.cost.toLocaleString()}` : `🔒 ${avatar.cost.toLocaleString()}`}
        </button>
      )}
    </div>
  );
}

/* ─── Emote Pack Card ─── */
function EmoteCard({
  pack,
  owned,
  equipped,
  canAfford,
  onBuy,
  onEquip,
}: {
  pack: EmotePackItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <div className={`relative glass-card rounded-2xl border p-4 transition-all duration-200 ${
      equipped ? "border-[#ffea00] glow-yellow" : owned ? "border-[#00ff8844]" : "border-[#1e1e40]"
    }`}>
      {equipped && (
        <div className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-widest text-[#ffea00] bg-[#ffea0015] border border-[#ffea0044] rounded-full px-2 py-0.5">
          Equipped
        </div>
      )}

      {/* Preview */}
      <div className="flex justify-center gap-3 py-4">
        {pack.emotes.map((emoji, idx) => (
          <div key={idx} className="w-10 h-10 rounded-xl bg-[#1e1e4044] border border-[#1e1e40] flex items-center justify-center text-2xl hover:scale-110 transition-transform">
            {emoji}
          </div>
        ))}
      </div>

      <p className="text-white font-black text-center text-base" style={{ fontFamily: "var(--font-display)" }}>{pack.name}</p>
      <p className="text-gray-500 text-xs text-center mt-1 mb-4">{pack.description}</p>

      {pack.cost === 0 || owned ? (
        <button
          id={`equip-emote-${pack.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all btn-press ${
            equipped
              ? "bg-[#ffea0022] border border-[#ffea0044] text-[#ffea00] cursor-default"
              : "border border-[#00ff8844] text-[#00ff88] hover:bg-[#00ff8815]"
          }`}
          onClick={onEquip}
          disabled={equipped}
        >
          {equipped ? "✓ Equipped" : "Equip"}
        </button>
      ) : (
        <button
          id={`buy-emote-${pack.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all btn-press ${
            canAfford
              ? "bg-[#ffea0015] border border-[#ffea0044] text-[#ffea00] hover:bg-[#ffea0025]"
              : "bg-[#1e1e40] border border-[#2a2a50] text-gray-600 cursor-not-allowed"
          }`}
          onClick={onBuy}
          disabled={!canAfford}
        >
          {canAfford ? `🪙 ${pack.cost.toLocaleString()} – Buy` : `🔒 ${pack.cost.toLocaleString()} Coins`}
        </button>
      )}
    </div>
  );
}

/* ─── Audio Pack Card ─── */
function AudioCard({
  pack,
  owned,
  equipped,
  canAfford,
  onBuy,
  onEquip,
  onPreview,
}: {
  pack: AudioPackItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onPreview: () => void;
}) {
  return (
    <div className={`relative glass-card rounded-2xl border p-4 transition-all duration-200 ${
      equipped ? "border-[#ffea00] glow-yellow" : owned ? "border-[#00ff8844]" : "border-[#1e1e40]"
    }`}>
      {equipped && (
        <div className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-widest text-[#ffea00] bg-[#ffea0015] border border-[#ffea0044] rounded-full px-2 py-0.5">
          Active
        </div>
      )}

      {/* Preview */}
      <div className="flex flex-col items-center justify-center py-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="w-12 h-12 rounded-full bg-[#00f3ff15] border border-[#00f3ff44] hover:bg-[#00f3ff25] active:scale-90 flex items-center justify-center text-xl mb-2 transition-all btn-press cursor-pointer relative group"
          title="Play sound preview"
        >
          {/* Glowing pulse ring */}
          <div className="absolute inset-0 rounded-full bg-[#00f3ff]/10 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-300 pointer-events-none" />
          🔊
        </button>
        <div className="text-[10px] uppercase font-bold tracking-widest text-gray-500">
          Waveform: <span className="text-[#00f3ff]">{pack.waveType}</span>
        </div>
      </div>

      <p className="text-white font-black text-center text-base" style={{ fontFamily: "var(--font-display)" }}>{pack.name}</p>
      <p className="text-gray-500 text-xs text-center mt-1 mb-4">{pack.description}</p>

      {pack.cost === 0 || owned ? (
        <button
          id={`equip-audio-${pack.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all btn-press ${
            equipped
              ? "bg-[#ffea0022] border border-[#ffea0044] text-[#ffea00] cursor-default"
              : "border border-[#00ff8844] text-[#00ff88] hover:bg-[#00ff8815]"
          }`}
          onClick={onEquip}
          disabled={equipped}
        >
          {equipped ? "✓ Active" : "Equip"}
        </button>
      ) : (
        <button
          id={`buy-audio-${pack.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all btn-press ${
            canAfford
              ? "bg-[#ffea0015] border border-[#ffea0044] text-[#ffea00] hover:bg-[#ffea0025]"
              : "bg-[#1e1e40] border border-[#2a2a50] text-gray-600 cursor-not-allowed"
          }`}
          onClick={onBuy}
          disabled={!canAfford}
        >
          {canAfford ? `🪙 ${pack.cost.toLocaleString()} – Buy` : `🔒 ${pack.cost.toLocaleString()} Coins`}
        </button>
      )}
    </div>
  );
}

/* ─── Arena Theme Card ─── */
function ArenaCard({
  theme,
  owned,
  equipped,
  canAfford,
  onBuy,
  onEquip,
}: {
  theme: ArenaThemeItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <div className={`relative glass-card rounded-2xl border p-4 transition-all duration-200 ${
      equipped ? "border-[#ffea00] glow-yellow" : owned ? "border-[#00ff8844]" : "border-[#1e1e40]"
    }`}>
      {equipped && (
        <div className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-widest text-[#ffea00] bg-[#ffea0015] border border-[#ffea0044] rounded-full px-2 py-0.5">
          Active
        </div>
      )}

      {/* Preview */}
      <div className="flex flex-col items-center justify-center py-3 gap-2">
        <div className="w-full max-w-[120px] h-12 rounded-xl border flex items-center justify-center p-1.5 gap-2 relative overflow-hidden"
          style={{
            borderColor: theme.colorPrimary,
            background: `radial-gradient(circle at center, ${theme.bgGridColor}, transparent)`,
            boxShadow: `0 0 10px ${theme.colorPrimary}22`
          }}>
          <div className="w-6 h-6 rounded-md border flex items-center justify-center text-[10px] font-black"
            style={{
              borderColor: theme.colorPrimary,
              color: theme.colorPrimary,
              textShadow: `0 0 4px ${theme.colorPrimary}`,
              boxShadow: `inset 0 0 4px ${theme.colorPrimary}33`
            }}>
            ✕
          </div>
          <div className="w-6 h-6 rounded-md border flex items-center justify-center text-[10px] font-black"
            style={{
              borderColor: theme.colorSecondary,
              color: theme.colorSecondary,
              textShadow: `0 0 4px ${theme.colorSecondary}`,
              boxShadow: `inset 0 0 4px ${theme.colorSecondary}33`
            }}>
            ○
          </div>
        </div>
      </div>

      <p className="text-white font-black text-center text-base" style={{ fontFamily: "var(--font-display)" }}>{theme.name}</p>
      <p className="text-gray-500 text-xs text-center mt-1 mb-4">{theme.description}</p>

      {theme.cost === 0 || owned ? (
        <button
          id={`equip-arena-${theme.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all btn-press ${
            equipped
              ? "bg-[#ffea0022] border border-[#ffea0044] text-[#ffea00] cursor-default"
              : "border border-[#00ff8844] text-[#00ff88] hover:bg-[#00ff8815]"
          }`}
          onClick={onEquip}
          disabled={equipped}
        >
          {equipped ? "✓ Active" : "Equip"}
        </button>
      ) : (
        <button
          id={`buy-arena-${theme.id}`}
          className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all btn-press ${
            canAfford
              ? "bg-[#ffea0015] border border-[#ffea0044] text-[#ffea00] hover:bg-[#ffea0025]"
              : "bg-[#1e1e40] border border-[#2a2a50] text-gray-600 cursor-not-allowed"
          }`}
          onClick={onBuy}
          disabled={!canAfford}
        >
          {canAfford ? `🪙 ${theme.cost.toLocaleString()} – Buy` : `🔒 ${theme.cost.toLocaleString()} Coins`}
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   NEON SHOP PAGE
   ══════════════════════════════════════════ */
export default function ShopPage() {
  const {
    coins,
    mounted,
    unlockedItems,
    selectedXOSkin,
    selectedAvatar,
    selectedEmotePack,
    selectedAudioPack,
    selectedArenaTheme,
    spendCoins,
    unlockItem,
    selectXOSkin,
    selectAvatar,
    selectEmotePack,
    selectAudioPack,
    selectArenaTheme,
    hapticsEnabled,
  } = usePlayerStats();
  const { playPurchase, playError, playPop, playPreview } = useSound();

  const [activeTab, setActiveTab] = useState<"skins" | "avatars" | "emotes" | "audio" | "arenas">("skins");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleBuySkin = (skin: XOSkin) => {
    if (coins < skin.cost) {
      playError();
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`Need ${skin.cost - coins} more coins! 🪙`, "error");
      return;
    }
    spendCoins(skin.cost);
    unlockItem(skin.id);
    selectXOSkin(skin.id);
    playPurchase();
    if (hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 30, 100]);
    showToast(`${skin.name} unlocked & equipped! 🎉`, "success");
  };

  const handleBuyAvatar = (avatar: AvatarItem) => {
    if (coins < avatar.cost) {
      playError();
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`Need ${avatar.cost - coins} more coins! 🪙`, "error");
      return;
    }
    spendCoins(avatar.cost);
    unlockItem(avatar.id);
    selectAvatar(avatar.id);
    playPurchase();
    if (hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 30, 100]);
    showToast(`${avatar.name} is now your avatar! 🎉`, "success");
  };

  const handleBuyEmotePack = (pack: EmotePackItem) => {
    if (coins < pack.cost) {
      playError();
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`Need ${pack.cost - coins} more coins! 🪙`, "error");
      return;
    }
    spendCoins(pack.cost);
    unlockItem(pack.id);
    selectEmotePack(pack.id);
    playPurchase();
    if (hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 30, 100]);
    showToast(`${pack.name} emotes unlocked! 😂`, "success");
  };

  const handleBuyAudioPack = (pack: AudioPackItem) => {
    if (coins < pack.cost) {
      playError();
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`Need ${pack.cost - coins} more coins! 🪙`, "error");
      return;
    }
    spendCoins(pack.cost);
    unlockItem(pack.id);
    selectAudioPack(pack.id);
    playPurchase();
    if (hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 30, 100]);
    showToast(`${pack.name} audio theme active! 👾`, "success");
  };

  const handleBuyArenaTheme = (theme: ArenaThemeItem) => {
    if (coins < theme.cost) {
      playError();
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`Need ${theme.cost - coins} more coins! 🪙`, "error");
      return;
    }
    spendCoins(theme.cost);
    unlockItem(theme.id);
    selectArenaTheme(theme.id);
    playPurchase();
    if (hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 30, 100]);
    showToast(`${theme.name} cyberpunk arena deployed! 🌐`, "success");
  };

  const handleEquipSkin = (skinId: string) => {
    selectXOSkin(skinId);
    playPop();
    showToast("Skin equipped!", "info");
  };

  const handleEquipAvatar = (avatarId: string) => {
    selectAvatar(avatarId);
    playPop();
    showToast("Avatar equipped!", "info");
  };

  const handleEquipEmotePack = (packId: string) => {
    selectEmotePack(packId);
    playPop();
    showToast("Emote pack equipped!", "info");
  };

  const handleEquipAudioPack = (packId: string) => {
    selectAudioPack(packId);
    playPop();
    showToast("Audio pack equipped!", "info");
  };

  const handleEquipArenaTheme = (themeId: string) => {
    selectArenaTheme(themeId);
    playPop();
    showToast("Arena theme equipped!", "info");
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden grid-bg">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #ffea000a 0%, transparent 70%)" }} />

      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        {/* ── Header ── */}
        <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-20 glass-panel border-b border-[#1e1e40]">
          <Link href="/"
            className="glass-card rounded-xl p-2.5 border border-[#1e1e40] hover:border-[#ffea0044] transition-colors btn-press"
            aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffea00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>

          <div className="flex-1">
            <h1 className="text-xl font-black uppercase text-[#ffea00] leading-none"
              style={{ fontFamily: "var(--font-display)", textShadow: "0 0 15px #ffea00" }}>
              🛒 Neon Shop
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Spend coins. Flex on opponents.</p>
          </div>

          {/* Coin balance */}
          <div className="glass-card rounded-xl px-3 py-2 border border-[#ffea0033] flex items-center gap-1.5">
            <span className="text-lg">🪙</span>
            <span className="coin-glow font-black text-base" style={{ fontFamily: "var(--font-display)" }}>
              {mounted ? coins.toLocaleString() : "···"}
            </span>
          </div>
        </header>

        {/* ── Tab selector ── */}
        <div className="flex overflow-x-auto gap-2 px-4 py-4 scrollbar-none whitespace-nowrap">
          <button
            id="tab-skins"
            className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition-all btn-press border ${
              activeTab === "skins"
                ? "bg-[#00f3ff15] border-[#00f3ff44] text-[#00f3ff]"
                : "bg-transparent border-[#1e1e40] text-gray-500 hover:border-[#00f3ff22]"
            }`}
            onClick={() => setActiveTab("skins")}
          >
            ⚡ XO Skins
          </button>
          <button
            id="tab-avatars"
            className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition-all btn-press border ${
              activeTab === "avatars"
                ? "bg-[#ff00f015] border-[#ff00f044] text-[#ff00f0]"
                : "bg-transparent border-[#1e1e40] text-gray-500 hover:border-[#ff00f022]"
            }`}
            onClick={() => setActiveTab("avatars")}
          >
            🎭 Avatars
          </button>
          <button
            id="tab-emotes"
            className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition-all btn-press border ${
              activeTab === "emotes"
                ? "bg-[#ffea0015] border-[#ffea0044] text-[#ffea00]"
                : "bg-transparent border-[#1e1e40] text-gray-500 hover:border-[#ffea0022]"
            }`}
            onClick={() => setActiveTab("emotes")}
          >
            💬 Emotes
          </button>
          <button
            id="tab-audio"
            className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition-all btn-press border ${
              activeTab === "audio"
                ? "bg-[#00ff8815] border-[#00ff8844] text-[#00ff88]"
                : "bg-transparent border-[#1e1e40] text-gray-500 hover:border-[#00ff8822]"
            }`}
            onClick={() => setActiveTab("audio")}
          >
            🎵 Audio
          </button>
          <button
            id="tab-arenas"
            className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition-all btn-press border ${
              activeTab === "arenas"
                ? "bg-[#ff220015] border-[#ff220044] text-[#ff2200]"
                : "bg-transparent border-[#1e1e40] text-gray-500 hover:border-[#ff220022]"
            }`}
            onClick={() => setActiveTab("arenas")}
          >
            🌐 Arenas
          </button>
        </div>

        {/* ── Content ── */}
        <main className="flex-1 px-4 pb-8 scroll-area">
          {/* Earn coins hint */}
          <div className="glass-card rounded-2xl border border-[#1e1e4066] p-3 mb-4 flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <p className="text-gray-400 text-xs leading-snug">
              Earn coins by <span className="text-[#00f3ff] font-bold">winning games</span> and maintaining your <span className="text-[#ffea00] font-bold">daily streak</span>!
            </p>
          </div>

          {/* ─ XO Skins tab ─ */}
          {activeTab === "skins" && (
            <div className="space-y-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#00f3ff] text-xs font-bold uppercase tracking-widest">
                  {unlockedItems.filter(id => XO_SKINS.some(s => s.id === id)).length} / {XO_SKINS.length} Unlocked
                </span>
              </div>
              {XO_SKINS.map((skin) => (
                <SkinCard
                  key={skin.id}
                  skin={skin}
                  owned={unlockedItems.includes(skin.id)}
                  equipped={selectedXOSkin === skin.id}
                  canAfford={coins >= skin.cost}
                  onBuy={() => handleBuySkin(skin)}
                  onEquip={() => handleEquipSkin(skin.id)}
                />
              ))}
            </div>
          )}

          {/* ─ Avatars tab ─ */}
          {activeTab === "avatars" && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#ff00f0] text-xs font-bold uppercase tracking-widest">
                  {unlockedItems.filter(id => AVATARS.some(a => a.id === id)).length} / {AVATARS.length} Unlocked
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {AVATARS.map((avatar) => (
                  <AvatarCard
                    key={avatar.id}
                    avatar={avatar}
                    owned={unlockedItems.includes(avatar.id)}
                    equipped={selectedAvatar === avatar.id}
                    canAfford={coins >= avatar.cost}
                    onBuy={() => handleBuyAvatar(avatar)}
                    onEquip={() => handleEquipAvatar(avatar.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─ Emotes tab ─ */}
          {activeTab === "emotes" && (
            <div className="space-y-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#ffea00] text-xs font-bold uppercase tracking-widest">
                  {unlockedItems.filter(id => EMOTE_PACKS.some(e => e.id === id)).length} / {EMOTE_PACKS.length} Unlocked
                </span>
              </div>
              {EMOTE_PACKS.map((pack) => (
                <EmoteCard
                  key={pack.id}
                  pack={pack}
                  owned={unlockedItems.includes(pack.id)}
                  equipped={selectedEmotePack === pack.id}
                  canAfford={coins >= pack.cost}
                  onBuy={() => handleBuyEmotePack(pack)}
                  onEquip={() => handleEquipEmotePack(pack.id)}
                />
              ))}
            </div>
          )}

          {/* ─ Audio tab ─ */}
          {activeTab === "audio" && (
            <div className="space-y-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#00ff88] text-xs font-bold uppercase tracking-widest">
                  {unlockedItems.filter(id => AUDIO_PACKS.some(a => a.id === id)).length} / {AUDIO_PACKS.length} Unlocked
                </span>
              </div>
              {AUDIO_PACKS.map((pack) => (
                <AudioCard
                  key={pack.id}
                  pack={pack}
                  owned={unlockedItems.includes(pack.id)}
                  equipped={selectedAudioPack === pack.id}
                  canAfford={coins >= pack.cost}
                  onBuy={() => handleBuyAudioPack(pack)}
                  onEquip={() => handleEquipAudioPack(pack.id)}
                  onPreview={() => playPreview(pack.waveType, pack.pitchMultiplier)}
                />
              ))}
            </div>
          )}

          {/* ─ Arenas tab ─ */}
          {activeTab === "arenas" && (
            <div className="space-y-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#ff2200] text-xs font-bold uppercase tracking-widest">
                  {unlockedItems.filter(id => ARENA_THEMES.some(t => t.id === id)).length} / {ARENA_THEMES.length} Unlocked
                </span>
              </div>
              {ARENA_THEMES.map((theme) => (
                <ArenaCard
                  key={theme.id}
                  theme={theme}
                  owned={unlockedItems.includes(theme.id)}
                  equipped={selectedArenaTheme === theme.id}
                  canAfford={coins >= theme.cost}
                  onBuy={() => handleBuyArenaTheme(theme)}
                  onEquip={() => handleEquipArenaTheme(theme.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

