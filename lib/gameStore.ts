// ═══════════════════════════════════════════════════════════
// lib/gameStore.ts — Central localStorage store for Mini Clash
// ═══════════════════════════════════════════════════════════

export interface XOSkin {
  id: string;
  name: string;
  xMark: string;
  oMark: string;
  cost: number;
  colorX: string;
  colorO: string;
  description: string;
}

export interface AvatarItem {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  description: string;
  glowColor: string;
}

export interface EmotePackItem {
  id: string;
  name: string;
  emotes: string[];
  cost: number;
  description: string;
}

export interface AudioPackItem {
  id: string;
  name: string;
  cost: number;
  description: string;
  waveType: OscillatorType;
  pitchMultiplier: number;
}

export interface ArenaThemeItem {
  id: string;
  name: string;
  cost: number;
  description: string;
  colorPrimary: string;
  colorSecondary: string;
  bgGridColor: string;
}

export const XO_SKINS: XOSkin[] = [
  {
    id: "default_xo",
    name: "Classic Neon",
    xMark: "✕",
    oMark: "○",
    cost: 0,
    colorX: "#00f3ff",
    colorO: "#ff00f0",
    description: "The OG neon look. Free forever.",
  },
  {
    id: "fire_ice",
    name: "Fire & Ice",
    xMark: "🔥",
    oMark: "🧊",
    cost: 500,
    colorX: "#ff6b00",
    colorO: "#00aaff",
    description: "Hot vs Cold — who dominates?",
  },
  {
    id: "ninja",
    name: "Ninja Pack",
    xMark: "⭐",
    oMark: "🌙",
    cost: 500,
    colorX: "#ffea00",
    colorO: "#bb88ff",
    description: "Silent but absolutely deadly.",
  },
  {
    id: "meme",
    name: "Meme Pack",
    xMark: "💀",
    oMark: "🤡",
    cost: 500,
    colorX: "#ffffff",
    colorO: "#ff4444",
    description: "No mercy. All chaos. Pure meme.",
  },
  {
    id: "pixel",
    name: "Pixel Royale",
    xMark: "🟦",
    oMark: "🟥",
    cost: 500,
    colorX: "#4488ff",
    colorO: "#ff4444",
    description: "8-bit retro arcade vibes.",
  },
];

export const AVATARS: AvatarItem[] = [
  {
    id: "default_avatar",
    name: "Gamer",
    emoji: "🎮",
    cost: 0,
    description: "Classic gamer energy.",
    glowColor: "#00f3ff",
  },
  {
    id: "cyber",
    name: "Cyber Bot",
    emoji: "🤖",
    cost: 1000,
    description: "Machine precision. Zero mercy.",
    glowColor: "#00ff88",
  },
  {
    id: "ninja_av",
    name: "Shadow Ninja",
    emoji: "🥷",
    cost: 1000,
    description: "Strike from the shadows.",
    glowColor: "#bb88ff",
  },
  {
    id: "alien",
    name: "Space Alien",
    emoji: "👾",
    cost: 1000,
    description: "Not from this dimension.",
    glowColor: "#00f3ff",
  },
  {
    id: "king",
    name: "The King",
    emoji: "👑",
    cost: 1000,
    description: "Royalty never ever loses.",
    glowColor: "#ffea00",
  },
  {
    id: "demon",
    name: "Demon Lord",
    emoji: "😈",
    cost: 1500,
    description: "Pure chaotic evil energy.",
    glowColor: "#ff00f0",
  },
];

export const EMOTE_PACKS: EmotePackItem[] = [
  {
    id: "classic_emotes",
    name: "Classic Chat",
    emotes: ["😂", "😡", "💀", "🤡"],
    cost: 0,
    description: "Standard trash talk emotions.",
  },
  {
    id: "flex_crown",
    name: "Flex & Crown",
    emotes: ["👑", "🔥", "🏆", "😎"],
    cost: 300,
    description: "Crown triggers for pure flex.",
  },
  {
    id: "savage",
    name: "Savage Pack",
    emotes: ["💩", "💸", "👻", "⚡"],
    cost: 400,
    description: "Utter disrespect. Pure dopamine.",
  },
  {
    id: "meme_troll",
    name: "Meme & Troll",
    emotes: ["🤪", "🤫", "🧠", "🥱"],
    cost: 500,
    description: "Brain freeze and shushing trolls.",
  },
];

export const AUDIO_PACKS: AudioPackItem[] = [
  {
    id: "classic_audio",
    name: "Retro Arcade",
    cost: 0,
    description: "Classic standard synth frequencies.",
    waveType: "triangle",
    pitchMultiplier: 1.0,
  },
  {
    id: "chiptune",
    name: "8-Bit Chiptune",
    cost: 600,
    description: "Vintage buzzing GameBoy sounds.",
    waveType: "square",
    pitchMultiplier: 0.85,
  },
  {
    id: "sci_fi",
    name: "Hyper Laser",
    cost: 800,
    description: "High-pitch sweep sci-fi blasters.",
    waveType: "sine",
    pitchMultiplier: 1.25,
  },
];

export const ARENA_THEMES: ArenaThemeItem[] = [
  {
    id: "default_arena",
    name: "Cyber Neon",
    cost: 0,
    description: "Original fluorescent cyan/pink glows.",
    colorPrimary: "#00f3ff",
    colorSecondary: "#ff00f0",
    bgGridColor: "rgba(0, 243, 255, 0.04)",
  },
  {
    id: "matrix",
    name: "Matrix Green",
    cost: 800,
    description: "Fluorescent falling code green lines.",
    colorPrimary: "#00ff88",
    colorSecondary: "#00aa44",
    bgGridColor: "rgba(0, 255, 136, 0.04)",
  },
  {
    id: "volt",
    name: "Volt Yellow",
    cost: 800,
    description: "Electric high-voltage sparks grid.",
    colorPrimary: "#ffea00",
    colorSecondary: "#ff6b00",
    bgGridColor: "rgba(255, 234, 0, 0.04)",
  },
  {
    id: "magma",
    name: "Magma Red",
    cost: 1000,
    description: "Volcanic blazing grids.",
    colorPrimary: "#ff2200",
    colorSecondary: "#ff6b00",
    bgGridColor: "rgba(255, 34, 0, 0.04)",
  },
];

export interface StreakData {
  lastVisit: string; // YYYY-MM-DD
  count: number;
}

export interface GameStore {
  coins: number;
  xp: number;
  unlockedItems: string[];
  selectedXOSkin: string;
  selectedAvatar: string;
  selectedEmotePack: string;
  selectedAudioPack: string;
  selectedArenaTheme: string;
  streak: StreakData;
}

export const DEFAULT_STORE: GameStore = {
  coins: 0,
  xp: 0,
  unlockedItems: ["default_xo", "default_avatar", "classic_emotes", "classic_audio", "default_arena"],
  selectedXOSkin: "default_xo",
  selectedAvatar: "default_avatar",
  selectedEmotePack: "classic_emotes",
  selectedAudioPack: "classic_audio",
  selectedArenaTheme: "default_arena",
  streak: { lastVisit: "", count: 0 },
};

const STORE_KEY = "mini_clash_store";
const LEGACY_KEY = "mini_clash_coins";

export function loadStore(): GameStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameStore>;
      return {
        ...DEFAULT_STORE,
        ...parsed,
        xp: parsed.xp ?? 0,
        streak: { ...DEFAULT_STORE.streak, ...(parsed.streak ?? {}) },
        unlockedItems: parsed.unlockedItems ?? DEFAULT_STORE.unlockedItems,
        selectedEmotePack: parsed.selectedEmotePack ?? DEFAULT_STORE.selectedEmotePack,
        selectedAudioPack: parsed.selectedAudioPack ?? DEFAULT_STORE.selectedAudioPack,
        selectedArenaTheme: parsed.selectedArenaTheme ?? DEFAULT_STORE.selectedArenaTheme,
      };
    }
    // Migrate legacy coins key
    const legacy = parseInt(localStorage.getItem(LEGACY_KEY) ?? "0", 10);
    return { ...DEFAULT_STORE, coins: isNaN(legacy) ? 0 : legacy };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function saveStore(store: GameStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

export function getSkinById(id: string): XOSkin {
  return XO_SKINS.find((s) => s.id === id) ?? XO_SKINS[0];
}

export function getAvatarById(id: string): AvatarItem {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

export function getEmotePackById(id: string): EmotePackItem {
  return EMOTE_PACKS.find((e) => e.id === id) ?? EMOTE_PACKS[0];
}

export function getAudioPackById(id: string): AudioPackItem {
  return AUDIO_PACKS.find((a) => a.id === id) ?? AUDIO_PACKS[0];
}

export function getArenaThemeById(id: string): ArenaThemeItem {
  return ARENA_THEMES.find((t) => t.id === id) ?? ARENA_THEMES[0];
}

// ── Daily Streak Logic ──────────────────────────────────────
export function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export interface StreakCheckResult {
  isFirstVisitToday: boolean;
  isConsecutive: boolean;
  newCount: number;
  coinsBonus: number;
}

// ── XP & Rank System ──────────────────────────────────────
export interface RankInfo {
  rankName: string;
  icon: string;
  color: string;
  currentTierXp: number;
  nextTierXp: number;
}

export function getRank(xp: number): RankInfo {
  if (xp < 200) {
    return { rankName: "Rookie", icon: "🥉", color: "#cd7f32", currentTierXp: 0,   nextTierXp: 200  };
  } else if (xp < 600) {
    return { rankName: "Pro",    icon: "🥈", color: "#c0c0c0", currentTierXp: 200, nextTierXp: 600  };
  } else if (xp < 1200) {
    return { rankName: "Neon Legend", icon: "🥇", color: "#ffea00", currentTierXp: 600,  nextTierXp: 1200 };
  } else {
    return { rankName: "Cyber God",   icon: "👑", color: "#00f3ff", currentTierXp: 1200, nextTierXp: 1200 };
  }
}

export function checkAndUpdateStreak(streak: StreakData): {
  updated: StreakData;
  result: StreakCheckResult;
} {
  const today = getTodayStr();
  const yesterday = getYesterdayStr();

  if (streak.lastVisit === today) {
    return {
      updated: streak,
      result: { isFirstVisitToday: false, isConsecutive: false, newCount: streak.count, coinsBonus: 0 },
    };
  }

  const isConsecutive = streak.lastVisit === yesterday;
  const newCount = isConsecutive ? streak.count + 1 : 1;
  // Bonus: Day 1 = 50, Day 2 = 100, Day 3 = 200, Day 4+ = 300 (capped)
  const coinsBonus = Math.min(50 * Math.pow(2, newCount - 1), 300);

  return {
    updated: { lastVisit: today, count: newCount },
    result: { isFirstVisitToday: true, isConsecutive, newCount, coinsBonus },
  };
}
