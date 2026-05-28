"use client";

import { useEffect, useState, useCallback } from "react";
import { getTodayStr } from "@/lib/gameStore";

/* ─────────────────────────────────────────────────────────────
   DailyQuests — localStorage-backed daily mission system
   Key: quests_YYYY-MM-DD  (auto-rotates each day)
───────────────────────────────────────────────────────────── */

export interface Quest {
  id: string;
  title: string;
  description: string;
  icon: string;
  goal: number;          // How many times needed
  progress: number;      // Current count
  reward: number;        // XP reward
  coinReward: number;    // Coin reward
  claimed: boolean;
}

type QuestTemplate = Omit<Quest, "progress" | "claimed">;

const QUEST_TEMPLATES: QuestTemplate[] = [
  { id: "win_2_games",    title: "Victory Rush",    description: "Win 2 games (any mode)",          icon: "🏆", goal: 2,    reward: 80,  coinReward: 100 },
  { id: "play_online",    title: "Social Clash",    description: "Play 1 online multiplayer match",  icon: "🌐", goal: 1,    reward: 50,  coinReward: 75  },
  { id: "win_xo",         title: "XO Domination",   description: "Win 3 XO Speedrun games",         icon: "⚡", goal: 3,    reward: 120, coinReward: 150 },
  { id: "tap_500",        title: "Tap Frenzy",      description: "Land 500 taps in Rage Tap",       icon: "👊", goal: 500,  reward: 60,  coinReward: 80  },
  { id: "win_bot",        title: "Bot Slayer",      description: "Beat the AI bot once",            icon: "🤖", goal: 1,    reward: 40,  coinReward: 60  },
  { id: "win_3_any",      title: "Win Streak",      description: "Win 3 games in a row (any mode)", icon: "🔥", goal: 3,    reward: 150, coinReward: 200 },
  { id: "play_5_games",   title: "Grinder",         description: "Play 5 games total",             icon: "🎮", goal: 5,    reward: 70,  coinReward: 90  },
  { id: "use_emote",      title: "Emote Lord",      description: "Send an emote in battle",        icon: "😂", goal: 1,    reward: 30,  coinReward: 40  },
];

const STORAGE_PREFIX = "mini_clash_quests_";

function getTodayKey(): string {
  return STORAGE_PREFIX + getTodayStr();
}

function pickDailyQuests(): Quest[] {
  // Deterministic daily shuffle based on today's date seed
  const seed = getTodayStr().replace(/-/g, "");
  const seedNum = parseInt(seed, 10);
  const shuffled = [...QUEST_TEMPLATES].sort(
    (a, b) => ((seedNum * a.id.charCodeAt(0)) % 97) - ((seedNum * b.id.charCodeAt(0)) % 97)
  );
  return shuffled.slice(0, 3).map((t) => ({
    ...t,
    progress: 0,
    claimed: false,
  }));
}

function loadTodayQuests(): Quest[] {
  try {
    const key = getTodayKey();
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Quest[];

    // Wipe all old quest keys
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    allKeys.forEach(k => { if (k !== key) localStorage.removeItem(k); });

    // Generate fresh quests for today
    const fresh = pickDailyQuests();
    localStorage.setItem(key, JSON.stringify(fresh));
    return fresh;
  } catch {
    return pickDailyQuests();
  }
}

function saveQuests(quests: Quest[]): void {
  try {
    localStorage.setItem(getTodayKey(), JSON.stringify(quests));
  } catch {}
}

/* ─── Public hook ─── */
export function useDailyQuests() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setQuests(loadTodayQuests());
    setMounted(true);
  }, []);

  const updateProgress = useCallback((questId: string, delta: number) => {
    setQuests((prev) => {
      const updated = prev.map((q) => {
        if (q.id !== questId || q.claimed) return q;
        return { ...q, progress: Math.min(q.goal, q.progress + delta) };
      });
      saveQuests(updated);
      return updated;
    });
  }, []);

  const claimQuest = useCallback((questId: string) => {
    let claimed: Quest | undefined;
    setQuests((prev) => {
      const updated = prev.map((q) => {
        if (q.id !== questId || q.claimed || q.progress < q.goal) return q;
        claimed = q;
        return { ...q, claimed: true };
      });
      saveQuests(updated);
      return updated;
    });
    return claimed;
  }, []);

  return { quests, mounted, updateProgress, claimQuest };
}

/* ─── Visual Quest Card Component ─── */
interface DailyQuestsProps {
  onClaim: (quest: Quest) => void;
}

export function DailyQuests({ onClaim }: DailyQuestsProps) {
  const { quests, mounted, claimQuest } = useDailyQuests();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  if (!mounted) return null;

  const handleClaim = (questId: string) => {
    setClaimingId(questId);
    setTimeout(() => {
      const claimed = claimQuest(questId);
      if (claimed) onClaim(claimed);
      setClaimingId(null);
    }, 300);
  };

  const allDone = quests.every((q) => q.claimed);

  return (
    <section
      className="glass-card rounded-2xl border border-[#00f3ff22] p-4 animate-slide-up"
      style={{ animationDelay: "0.25s", boxShadow: "0 0 20px #00f3ff08" }}
      aria-label="Daily Quests"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <div>
            <h3
              className="text-xs font-black uppercase tracking-widest text-[#00f3ff]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Daily Quests
            </h3>
            <p className="text-[9px] text-gray-600 uppercase tracking-wider">
              Resets at midnight
            </p>
          </div>
        </div>
        {allDone && (
          <span className="text-[10px] font-black uppercase tracking-wider text-[#00ff88] border border-[#00ff8844] rounded-full px-2 py-0.5 bg-[#00ff8808]">
            ✅ All Done!
          </span>
        )}
      </div>

      {/* Quest list */}
      <div className="space-y-2.5">
        {quests.map((quest) => {
          const pct = Math.min((quest.progress / quest.goal) * 100, 100);
          const isComplete = quest.progress >= quest.goal;
          const isClaiming = claimingId === quest.id;

          return (
            <div
              key={quest.id}
              className={`relative rounded-xl p-3 border transition-all duration-300 ${
                quest.claimed
                  ? "border-[#00ff8822] bg-[#00ff8806] opacity-60"
                  : isComplete
                  ? "border-[#00ff8844] bg-[#00ff8810]"
                  : "border-[#1e1e40] bg-[#0d0d1a60]"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <span className={`text-xl flex-shrink-0 mt-0.5 ${quest.claimed ? "grayscale" : ""}`}>
                  {quest.claimed ? "✅" : quest.icon}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-xs font-black uppercase tracking-wide leading-none ${
                        quest.claimed ? "text-gray-600" : "text-[#e8e8ff]"
                      }`}
                    >
                      {quest.title}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[9px] text-[#ffea00] font-bold">+{quest.reward} XP</span>
                      <span className="text-[9px] text-gray-600">·</span>
                      <span className="text-[9px] text-[#ffea00] font-bold">🪙{quest.coinReward}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                    {quest.description}
                  </p>

                  {/* Progress bar */}
                  {!quest.claimed && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[9px] text-gray-600 mb-1">
                        <span>{quest.progress} / {quest.goal}</span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#1e1e40] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: isComplete
                              ? "linear-gradient(90deg, #00ff88, #00f3ff)"
                              : "linear-gradient(90deg, #00f3ff44, #00f3ff88)",
                            boxShadow: isComplete ? "0 0 6px #00ff8888" : "none",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Claim button */}
                {isComplete && !quest.claimed && (
                  <button
                    id={`claim-quest-${quest.id}`}
                    onClick={() => handleClaim(quest.id)}
                    disabled={isClaiming}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider btn-press text-[#06060f] transition-all"
                    style={{
                      background: isClaiming
                        ? "#00ff8844"
                        : "linear-gradient(135deg, #00ff88, #00f3ff)",
                      boxShadow: "0 0 12px #00ff8855",
                    }}
                  >
                    {isClaiming ? "..." : "CLAIM"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
