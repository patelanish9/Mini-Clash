"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  GameStore,
  DEFAULT_STORE,
  loadStore,
  saveStore,
  getRank,
  RankInfo,
} from "@/lib/gameStore";

export type { GameStore };
export { getRank };
export type { RankInfo };

export interface PlayerStats {
  coins: number;
  xp: number;
  rank: RankInfo;
  unlockedItems: string[];
  selectedXOSkin: string;
  selectedAvatar: string;
  selectedEmotePack: string;
  selectedAudioPack: string;
  selectedArenaTheme: string;
  streak: GameStore["streak"];
  username: string;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  matchHistory: GameStore["matchHistory"];
  mounted: boolean;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addXP: (amount: number) => void;
  unlockItem: (itemId: string) => void;
  selectXOSkin: (skinId: string) => void;
  selectAvatar: (avatarId: string) => void;
  selectEmotePack: (packId: string) => void;
  selectAudioPack: (packId: string) => void;
  selectArenaTheme: (themeId: string) => void;
  updateStreak: (streak: GameStore["streak"]) => void;
  changeUsername: (name: string) => void;
  toggleSound: () => void;
  toggleHaptics: () => void;
  addMatchLog: (game: string, result: "Won" | "Lost" | "Draw", coins: number, xp: number) => void;
  resetAll: () => void;
}

export function usePlayerStats(): PlayerStats {
  const [store, setStore] = useState<GameStore>(DEFAULT_STORE);
  const [mounted, setMounted] = useState(false);
  // Ref for synchronous reads inside callbacks
  const storeRef = useRef<GameStore>(DEFAULT_STORE);

  useEffect(() => {
    const loaded = loadStore();
    storeRef.current = loaded;
    setStore(loaded);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    storeRef.current = store;
    saveStore(store);
  }, [store, mounted]);

  const addCoins = useCallback((amount: number) => {
    if (amount <= 0) return;
    setStore((prev) => ({ ...prev, coins: prev.coins + amount }));
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (storeRef.current.hapticsEnabled) {
        navigator.vibrate([30, 20, 50]);
      }
    }
  }, []);

  // Uses ref for synchronous check — no stale closure issue
  const spendCoins = useCallback((amount: number): boolean => {
    if (amount <= 0) return true;
    if (storeRef.current.coins < amount) return false;
    setStore((prev) => ({ ...prev, coins: Math.max(0, prev.coins - amount) }));
    return true;
  }, []);

  const addXP = useCallback((amount: number) => {
    if (amount <= 0) return;
    setStore((prev) => ({ ...prev, xp: prev.xp + amount }));
  }, []);

  const unlockItem = useCallback((itemId: string) => {
    setStore((prev) => ({
      ...prev,
      unlockedItems: [...new Set([...prev.unlockedItems, itemId])],
    }));
  }, []);

  const selectXOSkin = useCallback((skinId: string) => {
    setStore((prev) => ({ ...prev, selectedXOSkin: skinId }));
  }, []);

  const selectAvatar = useCallback((avatarId: string) => {
    setStore((prev) => ({ ...prev, selectedAvatar: avatarId }));
  }, []);

  const selectEmotePack = useCallback((packId: string) => {
    setStore((prev) => ({ ...prev, selectedEmotePack: packId }));
  }, []);

  const selectAudioPack = useCallback((packId: string) => {
    setStore((prev) => ({ ...prev, selectedAudioPack: packId }));
  }, []);

  const selectArenaTheme = useCallback((themeId: string) => {
    setStore((prev) => ({ ...prev, selectedArenaTheme: themeId }));
  }, []);

  const updateStreak = useCallback((streak: GameStore["streak"]) => {
    setStore((prev) => ({ ...prev, streak }));
  }, []);

  const changeUsername = useCallback((name: string) => {
    if (!name.trim()) return;
    setStore((prev) => ({ ...prev, username: name.trim().slice(0, 15) }));
  }, []);

  const toggleSound = useCallback(() => {
    setStore((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  const toggleHaptics = useCallback(() => {
    setStore((prev) => ({ ...prev, hapticsEnabled: !prev.hapticsEnabled }));
  }, []);

  const addMatchLog = useCallback((game: string, result: "Won" | "Lost" | "Draw", coins: number, xp: number) => {
    const log = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      game,
      result,
      coins,
      xp,
      date: new Date().toISOString().split("T")[0],
    };
    setStore((prev) => {
      const history = [log, ...(prev.matchHistory || [])].slice(0, 10);
      return { ...prev, matchHistory: history };
    });
  }, []);

  const resetAll = useCallback(() => {
    const fresh = { ...DEFAULT_STORE };
    storeRef.current = fresh;
    setStore(fresh);
    try {
      localStorage.removeItem("mini_clash_store");
      localStorage.removeItem("mini_clash_coins");
    } catch {}
  }, []);

  return {
    coins: store.coins,
    xp: store.xp,
    rank: getRank(store.xp),
    unlockedItems: store.unlockedItems,
    selectedXOSkin: store.selectedXOSkin,
    selectedAvatar: store.selectedAvatar,
    selectedEmotePack: store.selectedEmotePack,
    selectedAudioPack: store.selectedAudioPack,
    selectedArenaTheme: store.selectedArenaTheme,
    streak: store.streak,
    username: store.username,
    soundEnabled: store.soundEnabled,
    hapticsEnabled: store.hapticsEnabled,
    matchHistory: store.matchHistory,
    mounted,
    addCoins,
    spendCoins,
    addXP,
    unlockItem,
    selectXOSkin,
    selectAvatar,
    selectEmotePack,
    selectAudioPack,
    selectArenaTheme,
    updateStreak,
    changeUsername,
    toggleSound,
    toggleHaptics,
    addMatchLog,
    resetAll,
  };
}
