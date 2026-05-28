"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Matter from "matter-js";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useSound } from "@/hooks/useSound";
import { getArenaThemeById } from "@/lib/gameStore";

// The 11 Tiers of Neon Orbs with harmonized gradient themes
const ORB_TIERS = [
  { tier: 0, radius: 15, color: "#ffffff", shadow: "rgba(255,255,255,0.6)", name: "Spark", points: 2 },
  { tier: 1, radius: 24, color: "#3b82f6", shadow: "rgba(59,130,246,0.6)", name: "Pulse", points: 4 },   // Blue
  { tier: 2, radius: 32, color: "#10b981", shadow: "rgba(16,185,129,0.6)", name: "Neon", points: 8 },    // Green
  { tier: 3, radius: 42, color: "#eab308", shadow: "rgba(234,179,8,0.6)", name: "Flash", points: 16 },   // Yellow
  { tier: 4, radius: 52, color: "#f97316", shadow: "rgba(249,115,22,0.6)", name: "Blaze", points: 32 },   // Orange
  { tier: 5, radius: 64, color: "#ef4444", shadow: "rgba(239,68,68,0.6)", name: "Inferno", points: 64 },  // Red
  { tier: 6, radius: 76, color: "#ec4899", shadow: "rgba(236,72,153,0.6)", name: "Plasma", points: 128 }, // Pink
  { tier: 7, radius: 90, color: "#a855f7", shadow: "rgba(168,85,247,0.6)", name: "Nova", points: 256 },   // Purple
  { tier: 8, radius: 106, color: "#06b6d4", shadow: "rgba(6,182,212,0.6)", name: "Supernova", points: 512 }, // Cyan
  { tier: 9, radius: 124, color: "#fbbf24", shadow: "rgba(251,191,36,0.6)", name: "Star", points: 1024 },  // Gold
  { tier: 10, radius: 145, color: "#ff007f", shadow: "rgba(255,0,127,0.6)", name: "Blackhole", points: 2048 }, // Hot Rose
];

// Target points math for Level progression
const getLevelTarget = (lvl: number) => {
  return Math.floor(100 * Math.pow(lvl, 1.7)) + 100;
};

// Perks Catalog for Draft Overlay
interface Perk {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const PERKS_POOL: Perk[] = [
  { id: "magnetic", name: "Magnetic Neon", emoji: "🧲", description: "Identical orbs gently attract each other when close." },
  { id: "heavy_drop", name: "Heavy Drop", emoji: "🏋️", description: "Next 5 drops have 3.5x mass to easily smash stack bottlenecks." },
  { id: "fever_booster", name: "Fever Booster", emoji: "🔥", description: "Fever meter charges 50% faster." },
  { id: "soft_bounce", name: "Micro-Gravity Shield", emoji: "🛡️", description: "Reduces overall orb bounciness by 25%." },
  { id: "tide_dampener", name: "Tide Dampener", emoji: "🎈", description: "Reduces gravity swing range in Tidal levels." },
];

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export default function NeonMergeDrop() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const leftWallRef = useRef<Matter.Body | null>(null);
  const rightWallRef = useRef<Matter.Body | null>(null);

  const { coins, addCoins, spendCoins, addXP, addMatchLog, hapticsEnabled, selectedArenaTheme } = usePlayerStats();
  const { playTap, playPop, playWin, playLose, playTimerWarning, playCoin, playError } = useSound();
  const arena = getArenaThemeById(selectedArenaTheme);

  // Dynamic Page Hydration Guard
  const [pageMounted, setPageMounted] = useState(false);

  // States
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [nextOrbTier, setNextOrbTier] = useState(0);
  const [warningTimer, setWarningTimer] = useState<number | null>(null);

  // Combo system
  const [combo, setCombo] = useState(1);
  const lastMergeTime = useRef(0);

  // Fever Mode
  const [feverMeter, setFeverMeter] = useState(0); // 0 to 100
  const [feverActive, setFeverActive] = useState(false);
  const [feverTimeLeft, setFeverTimeLeft] = useState(0); // in seconds

  // Roguelike Draft perks
  const [activePerks, setActivePerks] = useState<string[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftChoices, setDraftChoices] = useState<Perk[]>([]);
  const [heavyDropsRemaining, setHeavyDropsRemaining] = useState(0);

  // Interactive Powerups
  const [activeTool, setActiveTool] = useState<"laser" | "upgrader" | null>(null);
  const [screenShaking, setScreenShaking] = useState(false);

  // Instruction Wizard Modal
  const [showWizard, setShowWizard] = useState(true);
  const [wizardStep, setWizardStep] = useState(0);

  // Time Dilation & Alerts triggers
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [squeezingOffset, setSqueezingOffset] = useState(0);

  // Set hydration complete state
  useEffect(() => {
    setPageMounted(true);
    const stored = localStorage.getItem("neon_merge_high_score");
    if (stored) setHighScore(parseInt(stored, 10));
  }, []);

  // Mutable References Map for audio and triggers
  const playTapRef = useRef(playTap);
  const playPopRef = useRef(playPop);
  const playWinRef = useRef(playWin);
  const playLoseRef = useRef(playLose);
  const playTimerWarningRef = useRef(playTimerWarning);
  const playCoinRef = useRef(playCoin);
  const playErrorRef = useRef(playError);

  useEffect(() => {
    playTapRef.current = playTap;
    playPopRef.current = playPop;
    playWinRef.current = playWin;
    playLoseRef.current = playLose;
    playTimerWarningRef.current = playTimerWarning;
    playCoinRef.current = playCoin;
    playErrorRef.current = playError;
  });

  const stateRef = useRef({
    score,
    level,
    gameOver,
    nextOrbTier,
    hapticsEnabled,
    warningStartTime: 0 as number,
    feverActive,
    activePerks,
    activeTool,
    heavyDropsRemaining,
  });

  useEffect(() => {
    stateRef.current = {
      score,
      level,
      gameOver,
      nextOrbTier,
      hapticsEnabled,
      warningStartTime: stateRef.current.warningStartTime,
      feverActive,
      activePerks,
      activeTool,
      heavyDropsRemaining,
    };
  }, [score, level, gameOver, nextOrbTier, hapticsEnabled, feverActive, activePerks, activeTool, heavyDropsRemaining]);

  // Audio synths sweeps
  const playSynthSound = useCallback((type: "level-up" | "fever" | "laser" | "shake" | "upgrade") => {
    if (typeof window === "undefined") return;
    try {
      const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxCtor) return;
      const ctx = new AudioCtxCtor();
      const t = ctx.currentTime;

      if (type === "level-up") {
        const notes = [329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t + idx * 0.08);
          gain.gain.setValueAtTime(0.3, t + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.35);
          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.4);
        });
      } else if (type === "fever") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(1500, t + 0.8);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.start(t);
        osc.stop(t + 0.85);
      } else if (type === "laser") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1800, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.3);
      } else if (type === "shake") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(65, t);
        osc.frequency.linearRampToValueAtTime(30, t + 0.5);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.55);
      } else if (type === "upgrade") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523, t);
        osc.frequency.setValueAtTime(784, t + 0.08);
        osc.frequency.setValueAtTime(1047, t + 0.16);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.32);
      }
    } catch (e) {}
  }, []);

  // Shockwave Blast impulse vector solver
  const triggerShockwaveBlast = useCallback(() => {
    if (!engineRef.current) return;
    const bodies = Matter.Composite.allBodies(engineRef.current.world);

    bodies.forEach((body) => {
      if (body.label && body.label.startsWith("orb-") && !body.isStatic) {
        const randomXForce = (Math.random() - 0.5) * body.mass * 0.018;
        const upwardForce = -body.mass * 0.075;
        Matter.Body.applyForce(body, body.position, { x: randomXForce, y: upwardForce });
      }
    });

    setScreenShaking(true);
    setTimeout(() => setScreenShaking(false), 300);
  }, []);

  // Memoized Level-Up trigger callbacks
  const triggerLevelUp = useCallback((targetLevel: number) => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    engine.timing.timeScale = 0.2;

    playSynthSound("level-up");
    if (stateRef.current.hapticsEnabled && navigator.vibrate) {
      navigator.vibrate([150, 80, 150, 300]);
    }

    triggerShockwaveBlast();
    setLevelUpMessage(`LEVEL ${targetLevel} UNLOCKED!`);

    let pauseDraft = false;
    if (targetLevel === 10 || targetLevel === 20 || targetLevel === 30 || targetLevel === 40) {
      pauseDraft = true;
    }

    setTimeout(() => {
      if (pauseDraft) {
        engine.timing.timeScale = 0.0;
        const shuffled = [...PERKS_POOL].sort(() => 0.5 - Math.random());
        setDraftChoices(shuffled.slice(0, 3));
        setDraftOpen(true);
      } else {
        engine.timing.timeScale = 1.0;
      }
      setLevelUpMessage(null);
    }, 2000);
  }, [playSynthSound, triggerShockwaveBlast]);

  // Fever Mode Activator
  const activateFeverMode = useCallback(() => {
    setFeverActive(true);
    setFeverTimeLeft(10);
    playSynthSound("fever");
    if (stateRef.current.hapticsEnabled && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    setFloatingTexts((prev) => [
      ...prev,
      { id: Date.now(), x: 225, y: 300, text: "🔥 NEON FEVER ACTIVATED! 🔥", color: "#ff00f0" }
    ]);
  }, [playSynthSound]);

  // Sync references for state solvers inside physics ticks
  const triggerLevelUpRef = useRef(triggerLevelUp);
  const activateFeverModeRef = useRef(activateFeverMode);

  useEffect(() => {
    triggerLevelUpRef.current = triggerLevelUp;
    activateFeverModeRef.current = activateFeverMode;
  });

  // Fever timing countdown loop
  useEffect(() => {
    if (!feverActive) return;

    const interval = setInterval(() => {
      setFeverTimeLeft((t) => {
        if (t <= 1) {
          setFeverActive(false);
          setFeverMeter(0);
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [feverActive]);

  // Floating text messages clean loop
  useEffect(() => {
    if (floatingTexts.length === 0) return;
    const interval = setInterval(() => {
      setFloatingTexts((prev) => prev.slice(1));
    }, 1500);
    return () => clearInterval(interval);
  }, [floatingTexts]);

  // Matter.js core engine setup - triggers EXACTLY ONCE when hydrated!
  useEffect(() => {
    if (!pageMounted || !sceneRef.current) return;

    const width = 450;
    const height = 600;

    const engine = Matter.Engine.create({
      gravity: { y: 1.0, scale: 0.001 }
    });
    engineRef.current = engine;

    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: width,
        height: height,
        wireframes: false,
        background: "transparent",
      },
    });

    const wallThickness = 60;
    const wallOptions = { isStatic: true, render: { fillStyle: "#1a1a2e" } };

    const ground = Matter.Bodies.rectangle(width / 2, height + wallThickness / 2 - 10, width * 2, wallThickness, wallOptions);
    const leftWall = Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, wallOptions);
    const rightWall = Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, wallOptions);

    leftWallRef.current = leftWall;
    rightWallRef.current = rightWall;

    Matter.World.add(engine.world, [ground, leftWall, rightWall]);

    const mergesQueue: Array<{ bodyA: Matter.Body; bodyB: Matter.Body; tier: number }> = [];

    // Collision listener
    Matter.Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;

        if (
          bodyA.label &&
          bodyB.label &&
          bodyA.label.startsWith("orb-") &&
          bodyA.label === bodyB.label &&
          !(bodyA as any).isMerged &&
          !(bodyB as any).isMerged
        ) {
          const tier = parseInt(bodyA.label.split("-")[1], 10);
          (bodyA as any).isMerged = true;
          (bodyB as any).isMerged = true;
          mergesQueue.push({ bodyA, bodyB, tier });
        }
      });
    });

    // Solve merges safely after update tick completes
    Matter.Events.on(engine, "afterUpdate", () => {
      if (mergesQueue.length === 0) return;

      mergesQueue.forEach(({ bodyA, bodyB, tier }) => {
        if (tier < ORB_TIERS.length - 1) {
          const nextTier = ORB_TIERS[tier + 1];
          const midX = (bodyA.position.x + bodyB.position.x) / 2;
          const midY = (bodyA.position.y + bodyB.position.y) / 2;

          Matter.World.remove(engine.world, [bodyA, bodyB]);

          const currentLevel = stateRef.current.level;

          // Restitution base calculations (Reduces by 25% under Soft Bounce perk)
          let baseRestitution = 0.25;
          if (currentLevel >= 11 && currentLevel <= 20) {
            baseRestitution = 0.25 + (currentLevel - 10) * 0.03;
          } else if (currentLevel > 20) {
            baseRestitution = 0.55;
          }

          if (stateRef.current.activePerks.includes("soft_bounce")) {
            baseRestitution *= 0.75;
          }

          const mergedOrb = Matter.Bodies.circle(midX, midY, nextTier.radius, {
            label: `orb-${tier + 1}`,
            restitution: baseRestitution,
            friction: 0.08,
            render: {
              fillStyle: nextTier.color,
              strokeStyle: "#ffffff",
              lineWidth: 1.5
            }
          });

          Matter.World.add(engine.world, mergedOrb);

          if (stateRef.current.hapticsEnabled && navigator.vibrate) {
            navigator.vibrate([40]);
          }
          playPopRef.current();

          // Combos checks
          const now = Date.now();
          let currentCombo = 1;
          if (now - lastMergeTime.current < 3000) {
            currentCombo = Math.min(5, stateRef.current.nextOrbTier + 1);
          }
          lastMergeTime.current = now;

          // Points score updates
          const pointsEarned = nextTier.points * currentCombo * (stateRef.current.feverActive ? 2 : 1);
          
          // Floating overlay text spawns
          setFloatingTexts((prev) => [
            ...prev,
            {
              id: Date.now() + Math.random(),
              x: midX,
              y: midY,
              text: currentCombo > 1 ? `Combo x${currentCombo}! +${pointsEarned} 💥` : `+${pointsEarned}`,
              color: nextTier.color
            }
          ]);

          // Fever charge accumulation
          let feverEarned = 10;
          if (stateRef.current.activePerks.includes("fever_booster")) {
            feverEarned = 15;
          }
          setFeverMeter((m) => {
            if (stateRef.current.feverActive) return 100;
            const nextMeter = Math.min(100, m + feverEarned);
            if (nextMeter >= 100) {
              setTimeout(() => activateFeverModeRef.current(), 10);
            }
            return nextMeter;
          });

          // Level Progression check
          setScore((prev) => {
            const nextScore = prev + pointsEarned;
            const targetScore = getLevelTarget(stateRef.current.level);

            if (nextScore >= targetScore) {
              const nextLevel = stateRef.current.level + 1;
              setLevel(nextLevel);
              setTimeout(() => triggerLevelUpRef.current(nextLevel), 20);
            }

            return nextScore;
          });
        } else {
          Matter.World.remove(engine.world, [bodyA, bodyB]);
          playWinRef.current();
          setScore((prev) => prev + 10000);
          setFloatingTexts((prev) => [
            ...prev,
            { id: Date.now(), x: 225, y: 300, text: "🌌 BLACKHOLE FUSION! +10,000 🚀", color: "#ff007f" }
          ]);
        }
      });

      mergesQueue.length = 0;
    });

    // Custom updates loop
    Matter.Events.on(engine, "beforeUpdate", (event) => {
      const currentLevel = stateRef.current.level;

      // 🧲 Magnetic perk attraction solver
      if (stateRef.current.activePerks.includes("magnetic")) {
        const bodies = Matter.Composite.allBodies(engine.world);
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const bA = bodies[i];
            const bB = bodies[j];

            if (
              bA.label &&
              bB.label &&
              bA.label === bB.label &&
              bA.label.startsWith("orb-") &&
              !bA.isStatic &&
              !bB.isStatic
            ) {
              const distanceVec = Matter.Vector.sub(bB.position, bA.position);
              const distance = Matter.Vector.magnitude(distanceVec);

              if (distance < 160 && distance > 10) {
                const pullStrength = bA.mass * bB.mass * 0.0000035;
                const pullVec = Matter.Vector.mult(Matter.Vector.normalise(distanceVec), pullStrength);
                Matter.Body.applyForce(bA, bA.position, pullVec);
                Matter.Body.applyForce(bB, bB.position, Matter.Vector.neg(pullVec));
              }
            }
          }
        }
      }

      // Mod 1: Fever Half-Gravity or Tidal swings
      if (stateRef.current.feverActive) {
        engine.world.gravity.y = 0.5;
      } else if (currentLevel >= 21 && currentLevel <= 40) {
        let tideSwing = 0.45;
        if (stateRef.current.activePerks.includes("tide_dampener")) {
          tideSwing = 0.22;
        }
        engine.world.gravity.y = 1.0 + Math.sin(event.timestamp / 1200) * tideSwing;
      } else {
        engine.world.gravity.y = 1.0;
      }

      // Mod 2: Container contracts walls
      if (currentLevel >= 41) {
        const targetSqueeze = (currentLevel - 40) * 8.5;
        setSqueezingOffset(targetSqueeze);

        Matter.Body.setPosition(leftWall, { x: -wallThickness / 2 + targetSqueeze, y: height / 2 });
        Matter.Body.setPosition(rightWall, { x: width + wallThickness / 2 - targetSqueeze, y: height / 2 });
      } else {
        setSqueezingOffset(0);
        Matter.Body.setPosition(leftWall, { x: -wallThickness / 2, y: height / 2 });
        Matter.Body.setPosition(rightWall, { x: width + wallThickness / 2, y: height / 2 });
      }

      // Fever decay check
      if (!stateRef.current.feverActive) {
        setFeverMeter((m) => {
          if (m <= 0) return 0;
          return Math.max(0, m - 0.05);
        });
      }

      // Overflow boundaries checks (y = 100 limit)
      let isOverflowing = false;
      const allBodies = Matter.Composite.allBodies(engine.world);

      allBodies.forEach((body) => {
        if (body.label && body.label.startsWith("orb-") && !body.isStatic) {
          const topEdge = body.position.y - (body as any).circleRadius;
          if (topEdge < 100) {
            isOverflowing = true;
          }
        }
      });

      if (isOverflowing && !stateRef.current.gameOver) {
        if (stateRef.current.warningStartTime === 0) {
          stateRef.current.warningStartTime = event.timestamp;
        } else {
          const timeElapsed = (event.timestamp - stateRef.current.warningStartTime) / 1000;
          const remaining = Math.max(0, 3 - Math.floor(timeElapsed));
          setWarningTimer(remaining);

          if (remaining > 0 && Math.floor(timeElapsed) % 1 === 0) {
            playTimerWarningRef.current();
          }

          if (timeElapsed >= 3.0) {
            setGameOver(true);
            playLoseRef.current();
            setWarningTimer(null);
          }
        }
      } else {
        stateRef.current.warningStartTime = 0;
        setWarningTimer(null);
      }
    });

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      if (render.canvas) render.canvas.remove();
    };
  }, [pageMounted]); // Run EXACTLY ONCE when hydrated!

  // Game over stats and awards updates
  useEffect(() => {
    if (gameOver) {
      let calculatedCoins = Math.min(250, Math.floor(score * 0.12));
      let calculatedXP = Math.min(300, Math.floor(score * 0.2) + level * 2);

      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem("neon_merge_high_score", score.toString());
      }

      addCoins(calculatedCoins);
      addXP(calculatedXP);
      addMatchLog("Neon Merge Drop", "Won", calculatedCoins, calculatedXP);
      playCoinRef.current();
    }
  }, [gameOver, score, highScore, level, addCoins, addXP, addMatchLog]);

  // Drop tap and touch handlers (hybrid support)
  const handleContainerTap = (e: React.TouchEvent | React.MouseEvent) => {
    // Prevent default touch behaviors to block synthetic click delays safely
    if (e.type === "touchstart") {
      try {
        if (e.cancelable) {
          e.preventDefault();
        }
      } catch (err) {}
    }

    if (gameOver || !engineRef.current || warningTimer !== null && warningTimer <= 0) return;
    if (draftOpen || showWizard) return;

    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX = 0;
    let clientY = 0;

    if (e.type === "touchstart" || e.type === "touchend" || "touches" in e) {
      const touchEv = e as React.TouchEvent;
      const touch = touchEv.touches[0] || touchEv.changedTouches[0];
      if (touch) {
        clientX = touch.clientX;
        clientY = touch.clientY;
      }
    } else {
      const mouseEv = e as React.MouseEvent;
      clientX = mouseEv.clientX;
      clientY = mouseEv.clientY;
    }

    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    // Laser & Upgrader targeting clicks
    if (stateRef.current.activeTool) {
      const clickedBody = Matter.Query.point(
        Matter.Composite.allBodies(engineRef.current.world),
        { x: relativeX, y: relativeY }
      )[0];

      if (clickedBody && clickedBody.label && clickedBody.label.startsWith("orb-") && !clickedBody.isStatic) {
        if (stateRef.current.activeTool === "laser") {
          Matter.World.remove(engineRef.current.world, clickedBody);
          playPopRef.current();
          setFloatingTexts((prev) => [
            ...prev,
            { id: Date.now(), x: clickedBody.position.x, y: clickedBody.position.y, text: "💥 LASERED!", color: "#ef4444" }
          ]);
          setActiveTool(null);
        } else if (stateRef.current.activeTool === "upgrader") {
          const tier = parseInt(clickedBody.label.split("-")[1], 10);
          if (tier < ORB_TIERS.length - 1) {
            const nextTier = ORB_TIERS[tier + 1];
            Matter.World.remove(engineRef.current.world, clickedBody);

            const upgradedOrb = Matter.Bodies.circle(clickedBody.position.x, clickedBody.position.y, nextTier.radius, {
              label: `orb-${tier + 1}`,
              restitution: 0.25,
              friction: 0.08,
              render: {
                fillStyle: nextTier.color,
                strokeStyle: "#ffffff",
                lineWidth: 1.5
              }
            });

            Matter.World.add(engineRef.current.world, upgradedOrb);
            playSynthSound("upgrade");
            setFloatingTexts((prev) => [
              ...prev,
              { id: Date.now(), x: clickedBody.position.x, y: clickedBody.position.y, text: "⬆️ UPGRADED!", color: "#10b981" }
            ]);
          } else {
            playErrorRef.current();
          }
          setActiveTool(null);
        }
      } else {
        // Clicked on empty space inside target tool: Deactivate and trigger release log to prevent deadlocks!
        setActiveTool(null);
        setFloatingTexts((prev) => [
          ...prev,
          { id: Date.now(), x: relativeX, y: relativeY, text: "Tool Cancelled ❌", color: "#ffffff" }
        ]);
      }
      return;
    }

    const currentSqueeze = squeezingOffset;
    const leftLimit = currentSqueeze + 24;
    const rightLimit = 450 - currentSqueeze - 24;
    const dropX = Math.max(leftLimit, Math.min(relativeX, rightLimit));

    const tierData = ORB_TIERS[nextOrbTier];

    let currentRestitution = 0.25;
    if (level >= 11 && level <= 20) {
      currentRestitution = 0.25 + (level - 10) * 0.03;
    } else if (level > 20) {
      currentRestitution = 0.55;
    }

    if (activePerks.includes("soft_bounce")) {
      currentRestitution *= 0.75;
    }

    let dropMass = 1.0;
    const hasHeavyPerk = heavyDropsRemaining > 0;
    if (hasHeavyPerk) {
      dropMass = 3.5;
      setHeavyDropsRemaining((r) => r - 1);
    }

    const newOrb = Matter.Bodies.circle(dropX, 90, tierData.radius, {
      label: `orb-${tierData.tier}`,
      restitution: currentRestitution,
      friction: 0.08,
      render: {
        fillStyle: tierData.color,
        strokeStyle: hasHeavyPerk ? "#ffea00" : "#ffffff",
        lineWidth: hasHeavyPerk ? 3.0 : 1.5
      }
    });

    if (hasHeavyPerk) {
      Matter.Body.setMass(newOrb, newOrb.mass * dropMass);
      setFloatingTexts((prev) => [
        ...prev,
        { id: Date.now(), x: dropX, y: 150, text: "🏋️ HEAVY DROP", color: "#ffea00" }
      ]);
    }

    Matter.World.add(engineRef.current.world, newOrb);
    playTapRef.current();

    if (hapticsEnabled && navigator.vibrate) {
      navigator.vibrate([25]);
    }

    setNextOrbTier(Math.floor(Math.random() * 3));
  };

  const buyEarthquake = () => {
    if (draftOpen || gameOver || showWizard) return;
    if (spendCoins(60)) {
      playSynthSound("shake");
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate([80, 50, 80, 50, 150]);

      if (engineRef.current) {
        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        bodies.forEach((body) => {
          if (body.label && body.label.startsWith("orb-") && !body.isStatic) {
            const forceX = (Math.random() - 0.5) * body.mass * 0.14;
            const forceY = -body.mass * 0.11;
            Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });
          }
        });
      }

      setScreenShaking(true);
      setTimeout(() => setScreenShaking(false), 500);

      setFloatingTexts((prev) => [
        ...prev,
        { id: Date.now(), x: 225, y: 300, text: "🌋 EARTHQUAKE SHAKE!", color: "#eab308" }
      ]);
    } else {
      playErrorRef.current();
      alert("Nahi hai coins! Khel ke coins kamao! 🪙");
    }
  };

  const buyLaser = () => {
    if (draftOpen || gameOver || showWizard) return;
    if (activeTool === "laser") {
      setActiveTool(null);
      return;
    }

    if (spendCoins(40)) {
      playSynthSound("laser");
      setActiveTool("laser");
      setFloatingTexts((prev) => [
        ...prev,
        { id: Date.now(), x: 225, y: 300, text: "☄️ Laser Beam Ready! Tap any bubble to destroy.", color: "#ef4444" }
      ]);
    } else {
      playErrorRef.current();
      alert("Insufficient Coins! 🪙");
    }
  };

  const buyUpgrader = () => {
    if (draftOpen || gameOver || showWizard) return;
    if (activeTool === "upgrader") {
      setActiveTool(null);
      return;
    }

    if (spendCoins(100)) {
      playSynthSound("upgrade");
      setActiveTool("upgrader");
      setFloatingTexts((prev) => [
        ...prev,
        { id: Date.now(), x: 225, y: 300, text: "⬆️ Upgrader Active! Tap any bubble to upgrade.", color: "#10b981" }
      ]);
    } else {
      playErrorRef.current();
      alert("Insufficient Coins! 🪙");
    }
  };

  const claimPerkDraft = (perkId: string) => {
    setActivePerks((prev) => [...prev, perkId]);
    playCoinRef.current();

    if (perkId === "heavy_drop") {
      setHeavyDropsRemaining(5);
    }

    setDraftOpen(false);

    if (engineRef.current) {
      engineRef.current.timing.timeScale = 1.0;
    }
  };

  const targetThreshold = getLevelTarget(level);
  const previousTarget = level === 1 ? 0 : getLevelTarget(level - 1);
  const progressPercent = Math.min(
    100,
    Math.floor(((score - previousTarget) / (targetThreshold - previousTarget)) * 100)
  );

  // If page is not mounted, render full screen loading state to fully escape SSR hydration issues!
  if (!pageMounted) {
    return (
      <div className="min-h-dvh bg-[#05050e] flex items-center justify-center">
        <div className="text-[#00f3ff] animate-pulse font-black uppercase tracking-widest text-sm">
          Loading Cyber Arena...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-dvh max-w-md mx-auto flex flex-col overflow-hidden select-none relative pt-[env(safe-area-inset-top)] bg-[#05050e] transition-transform duration-75 ${
        screenShaking ? "animate-screen-shake" : ""
      }`}
      style={{
        backgroundImage: `
          linear-gradient(${arena.bgGridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${arena.bgGridColor} 1px, transparent 1px)
        `,
        backgroundSize: "45px 45px"
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 z-0"
        style={{
          background: feverActive
            ? "radial-gradient(circle at 50% 60%, rgba(255, 0, 240, 0.16) 0%, transparent 75%)"
            : `radial-gradient(circle at 50% 70%, ${ORB_TIERS[nextOrbTier].color}12 0%, transparent 60%)`
        }}
      />

      {/* Floating combat messages */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {floatingTexts.map((txt) => (
          <div
            key={txt.id}
            className="floating-combat-text"
            style={{
              left: `${txt.x}px`,
              top: `${txt.y}px`,
              color: txt.color,
            }}
          >
            {txt.text}
          </div>
        ))}
      </div>

      {/* Top Header Panel */}
      <header className="flex justify-between items-center px-4 py-3 bg-[#0d0d1e]/85 backdrop-blur-md border-b border-[#1e1e40] z-20">
        <div className="flex gap-2">
          <Link
            href="/"
            className="glass-card rounded-xl p-2 border border-[#1e1e40] text-gray-400 hover:text-white transition-colors btn-press cursor-pointer flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>

          {/* Help Wizard button */}
          <button
            onClick={() => { setWizardStep(0); setShowWizard(true); }}
            className="glass-card rounded-xl p-2 border border-[#1e1e40] text-gray-400 hover:text-[#ffea00] transition-colors btn-press cursor-pointer flex items-center justify-center font-bold text-sm"
          >
            ❓ Help
          </button>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Score</span>
          <span
            className="text-2xl font-black text-white"
            style={{ fontFamily: "var(--font-display)", textShadow: "0 0 10px rgba(255,255,255,0.4)" }}
          >
            {score}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">High</span>
          <span className="text-sm font-bold text-[#ffea00] coin-glow">{highScore}</span>
        </div>
      </header>

      {/* Level Progress Indicator */}
      <div className="bg-[#0b0b18]/70 px-4 py-2 border-b border-[#1e1e40] z-10 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-base animate-bounce" style={{ animationDuration: "1.5s" }}>🚀</span>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest leading-none">
              <span
                style={{
                  color: level <= 10 ? "#00f3ff" : level <= 20 ? "#10b981" : level <= 40 ? "#ffea00" : "#ff007f",
                  textShadow: `0 0 6px ${level <= 10 ? "#00f3ff" : level <= 20 ? "#10b981" : level <= 40 ? "#ffea00" : "#ff007f"}44`
                }}
              >
                {level <= 10 ? "ARCADE MODE" : level <= 20 ? "BOUNCE CHAOS" : level <= 40 ? "GRAVITY TIDE" : "GOD SQUEEZE ⚠️"}
              </span>
              <span className="text-gray-400 tabular-nums">
                {score - previousTarget} / {targetThreshold - previousTarget}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#161632] overflow-hidden mt-1.5 border border-[#1e1e40]/60 relative">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercent}%`,
                  background: `linear-gradient(90deg, ${arena.colorPrimary}, ${arena.colorSecondary})`,
                  boxShadow: `0 0 8px ${arena.colorPrimary}dd`
                }}
              />
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-widest leading-none">Level</span>
          <span
            className={`text-xl font-black ${
              level >= 41 ? "text-[#ff007f] animate-pulse" : "text-[#00f3ff]"
            }`}
            style={{ fontFamily: "var(--font-display)", textShadow: `0 0 10px ${level >= 41 ? "#ff007f" : "#00f3ff"}dd` }}
          >
            {level}/50
          </span>
        </div>
      </div>

      {/* Fever Meter HUD */}
      <div className="bg-[#0c0c1b]/45 px-4 py-1.5 border-b border-[#1e1e36] z-10 flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm">🔥</span>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between text-[8px] font-black tracking-widest text-[#ff00f0]">
              <span>FEVER CHARGE METER</span>
              <span className="tabular-nums">{feverActive ? "100%" : `${Math.floor(feverMeter)}%`}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#1e0a24] overflow-hidden mt-1 border border-[#ff00f0]/20">
              <div
                className={`h-full rounded-full ${feverActive ? "animate-pulse" : ""}`}
                style={{
                  width: feverActive ? "100%" : `${feverMeter}%`,
                  background: "linear-gradient(90deg, #ff00f0, #eab308)",
                  boxShadow: feverActive ? "0 0 8px #ff00f0" : "none"
                }}
              />
            </div>
          </div>
        </div>

        {feverActive && (
          <div className="bg-[#ff00f0]/20 border border-[#ff00f0]/40 rounded px-1.5 py-0.5 animate-pulse">
            <span className="text-[8px] font-black text-[#ff00f0] uppercase tracking-wider">
              FEVER: {feverTimeLeft}S
            </span>
          </div>
        )}
      </div>

      {/* Next Item Panel */}
      <div className="bg-[#0d0d1e]/20 px-4 py-2 flex items-center justify-between border-b border-[#1e1e36] z-10 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase text-gray-500 font-black">Next:</span>
          <div
            className="w-4 h-4 rounded-full border border-white/20 transition-all duration-300"
            style={{
              backgroundColor: ORB_TIERS[nextOrbTier].color,
              boxShadow: `0 0 10px ${ORB_TIERS[nextOrbTier].shadow}`
            }}
          />
          <span className="text-[10px] font-bold text-white uppercase">{ORB_TIERS[nextOrbTier].name}</span>
        </div>

        {activePerks.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase text-gray-500 font-black mr-1">Perks:</span>
            {activePerks.map((p) => {
              const info = PERKS_POOL.find((item) => item.id === p);
              return (
                <span
                  key={p}
                  title={info?.name}
                  className="text-xs filter drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]"
                >
                  {info?.emoji}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Matter.js Physics Engine container div */}
      <div
        className={`flex-1 w-full relative touch-none overflow-hidden cursor-pointer ${
          feverActive ? "border-4 border-double border-[#ff00f0] animate-pulse" : ""
        }`}
        onClick={handleContainerTap}
      >
        {/* Targeting active powerup tools overlays */}
        {activeTool && (
          <div className="absolute inset-0 bg-red-950/20 backdrop-blur-[1px] border border-red-500/20 flex flex-col justify-center items-center pointer-events-none z-10 animate-pulse">
            <div className="bg-black/90 border border-red-500/40 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
                🎯 {activeTool === "laser" ? "LASER ACTIVATED" : "UPGRADER ACTIVE"}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Tap any bubble in the container to use tool</p>
            </div>
          </div>
        )}

        {/* Dynamic Squeezing visual walls */}
        <div
          className="absolute top-0 bottom-0 left-0 border-r-2 border-dashed transition-all duration-300 pointer-events-none z-10"
          style={{
            width: `${squeezingOffset}px`,
            background: `linear-gradient(90deg, rgba(255, 0, 127, 0.05) 0%, transparent 100%)`,
            borderColor: level >= 41 ? "rgba(255, 0, 127, 0.4)" : "rgba(0, 243, 255, 0.25)"
          }}
        >
          {level >= 41 && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-[#ff007f] font-black uppercase tracking-widest vertical-text select-none animate-pulse">
              🔥 SQUEEZING
            </div>
          )}
        </div>

        <div
          className="absolute top-0 bottom-0 right-0 border-l-2 border-dashed transition-all duration-300 pointer-events-none z-10"
          style={{
            width: `${squeezingOffset}px`,
            background: `linear-gradient(270deg, rgba(255, 0, 127, 0.05) 0%, transparent 100%)`,
            borderColor: level >= 41 ? "rgba(255, 0, 127, 0.4)" : "rgba(0, 243, 255, 0.25)"
          }}
        >
          {level >= 41 && (
            <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-[#ff007f] font-black uppercase tracking-widest vertical-text select-none animate-pulse">
              🔥 SQUEEZING
            </div>
          )}
        </div>

        {/* Drop critical line boundary (y = 100) */}
        <div
          className="absolute top-[100px] left-0 right-0 border-t border-dashed pointer-events-none transition-colors duration-300"
          style={{
            borderColor: warningTimer !== null ? "#ef4444" : "rgba(30,30,64,0.4)"
          }}
        />

        {/* Combo Multiplier indicator */}
        {combo > 1 && (
          <div className="absolute top-4 left-4 bg-black/75 border border-[#ff00f0]/30 rounded-xl px-2.5 py-1 pointer-events-none z-10 flex items-center gap-1.5 animate-bounce">
            <span className="text-xs">⚡</span>
            <span
              className="text-[10px] font-black uppercase tracking-wider text-[#ff00f0]"
              style={{ textShadow: "0 0 8px #ff00f0" }}
            >
              Combo x{combo}!
            </span>
          </div>
        )}

        {/* Overflow warning banner */}
        {warningTimer !== null && (
          <div className="absolute top-[60px] left-1/2 -translate-x-1/2 bg-red-950/95 border border-red-500/30 rounded-full px-4 py-1 text-center pointer-events-none z-10 flex items-center gap-2 animate-bounce">
            <span className="text-xs">⚠️</span>
            <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">
              OVERFLOW IN {warningTimer}S!
            </span>
          </div>
        )}

        {/* Gravity Flux alert banner */}
        {!feverActive && level >= 21 && level <= 40 && (
          <div className="absolute top-[20px] right-4 bg-[#ffea00]/15 border border-[#ffea00]/30 rounded-xl px-2.5 py-1 text-center pointer-events-none z-10 flex items-center gap-1.5 animate-pulse">
            <span className="text-xs">🌊</span>
            <span className="text-[9px] font-black uppercase text-[#ffea00] tracking-wider leading-none">
              GRAVITY TIDE
            </span>
          </div>
        )}

        {/* Level Up slow-mo screen flash alerts */}
        {levelUpMessage && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-45 animate-fade-in">
            {/* Cyber neon grid background for Level Up screen */}
            <div className="absolute inset-0 opacity-15 pointer-events-none bg-[linear-gradient(rgba(255,0,240,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,240,0.08)_1px,transparent_1px)] bg-[size:30px_30px]" />
            <div className="absolute w-[280px] h-[280px] rounded-full bg-[#ff00f0]/10 blur-[60px] pointer-events-none animate-pulse" />
            <div className="absolute w-[280px] h-[280px] rounded-full bg-[#00f3ff]/10 blur-[60px] pointer-events-none animate-pulse" style={{ animationDelay: "1s" }} />

            <div className="text-center p-8 bg-[#0b0b18]/90 border border-[#ff00f0]/40 rounded-[32px] max-w-xs shadow-2xl relative overflow-hidden animate-winner-appear"
                 style={{ boxShadow: "0 0 40px rgba(255, 0, 240, 0.25), inset 0 0 20px rgba(0, 243, 255, 0.1)" }}>
              {/* Outer rotating neon neon glow borders */}
              <div className="absolute inset-0 border border-dashed border-[#00f3ff]/30 rounded-[32px] animate-spin" style={{ animationDuration: "12s" }} />

              <span className="text-5xl animate-bounce block mb-4">✨ LEVEL UP ✨</span>
              
              {/* Score milestone header */}
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black leading-none mb-2">Milestone Reached</p>
              
              {/* Level Transfer details */}
              <div className="flex items-center justify-center gap-4 my-6 py-3 px-4 bg-black/50 border border-[#1e1e40] rounded-2xl">
                <div className="text-center">
                  <p className="text-[9px] text-gray-500 font-bold uppercase leading-none">PREV</p>
                  <p className="text-xl font-black text-gray-400 mt-1 tabular-nums">{level - 1}</p>
                </div>
                <span className="text-xl text-[#ff00f0] animate-pulse">➔</span>
                <div className="text-center">
                  <p className="text-[9px] text-[#00f3ff] font-bold uppercase leading-none">CURRENT</p>
                  <p className="text-3xl font-black text-[#00f3ff] mt-0.5 tabular-nums animate-pulse" style={{ textShadow: "0 0 10px #00f3ff" }}>
                    {level}
                  </p>
                </div>
              </div>

              {/* Status information detailing active mod */}
              <div className="my-4 text-center">
                <h4 className="text-sm font-black text-[#ffea00] uppercase tracking-wide leading-tight">
                  {level <= 10 ? "ARCADE MODE" : level <= 20 ? "BOUNCE CHAOS!" : level <= 40 ? "GRAVITY TIDE INITIATED!" : "GOD SQUEEZE ACTIVE!"}
                </h4>
                <p className="text-[9px] text-gray-400 mt-1.5 leading-snug">
                  {level <= 10 ? "Standard gravity and drop rules apply." : 
                   level <= 20 ? "Orb restitution has been amplified! Expect springy bounds." : 
                   level <= 40 ? "Gravity is fluctuating dynamically! Stacks will float and sway." : 
                   "Container walls are slowly contracting! Merge items fast."}
                </p>
              </div>

              {/* Time dilation indicator */}
              <div className="mt-6 flex items-center justify-center gap-1.5 text-[#ff00f0]">
                <span className="w-2 h-2 rounded-full bg-[#ff00f0] animate-ping" />
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">
                  Resuming Solver Chrono...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Heavy Drops ammunition counter */}
        {heavyDropsRemaining > 0 && (
          <div className="absolute bottom-4 left-4 bg-black/85 border border-[#ffea00]/30 rounded-xl px-2.5 py-1 pointer-events-none z-10 text-[9px] font-bold text-[#ffea00] flex items-center gap-1">
            <span>🏋️ HEAVY AMMO: {heavyDropsRemaining}</span>
          </div>
        )}

        {/* The Matter.js Canvas Injects Here */}
        <div ref={sceneRef} className="absolute inset-0 flex justify-center items-center w-full h-full" />
      </div>

      {/* Interactive Power-Ups Shop Panel */}
      <section className="bg-[#0b0b18] px-4 py-2.5 border-t border-[#1e1e40] z-20 flex justify-between gap-3.5 shadow-2xl">
        <button
          onClick={buyLaser}
          className={`flex-1 p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all btn-press cursor-pointer ${
            activeTool === "laser"
              ? "bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444]"
              : "bg-[#0d0d1e]/80 border-[#ef4444]/30 hover:border-[#ef4444]/60 text-white"
          }`}
        >
          <span className="text-lg">☄️</span>
          <span className="text-[8px] font-black uppercase tracking-wider">Laser Beam</span>
          <span className="text-[9px] text-[#ffea00] font-black leading-none">🪙 40</span>
        </button>

        <button
          onClick={buyEarthquake}
          className="flex-1 p-2.5 rounded-xl border bg-[#0d0d1e]/80 border-[#eab308]/30 hover:border-[#eab308]/60 text-white flex flex-col items-center gap-1 transition-all btn-press cursor-pointer"
        >
          <span className="text-lg">🌋</span>
          <span className="text-[8px] font-black uppercase tracking-wider">Earthquake</span>
          <span className="text-[9px] text-[#ffea00] font-black leading-none">🪙 60</span>
        </button>

        <button
          onClick={buyUpgrader}
          className={`flex-1 p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all btn-press cursor-pointer ${
            activeTool === "upgrader"
              ? "bg-[#10b981]/20 border-[#10b981] text-[#10b981]"
              : "bg-[#0d0d1e]/80 border-[#10b981]/30 hover:border-[#10b981]/60 text-white"
          }`}
        >
          <span className="text-lg">⬆️</span>
          <span className="text-[8px] font-black uppercase tracking-wider">Upgrader</span>
          <span className="text-[9px] text-[#ffea00] font-black leading-none">🪙 100</span>
        </button>
      </section>

      {/* Catalog Tiers list Reference bar footer */}
      <footer className="bg-[#070712] px-3 py-1.5 border-t border-[#1e1e40]/70 z-10">
        <div className="flex justify-between items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {ORB_TIERS.map((tier, idx) => (
            <div key={idx} className="flex flex-col items-center flex-shrink-0 min-w-[28px]">
              <div
                className="w-4 h-4 rounded-full border border-white/10"
                style={{
                  backgroundColor: tier.color,
                  boxShadow: `0 0 5px ${tier.shadow}`
                }}
              />
              <span className="text-[8px] text-gray-500 font-bold mt-1 tabular-nums">{tier.points}</span>
            </div>
          ))}
        </div>
      </footer>

      {/* 🔮 Interactive How to Play Arcade Wizard Overlay Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 animate-pop-in">
          <div
            className="w-full max-w-sm glass-card rounded-3xl border border-[#00f3ff]/40 p-8 text-center flex flex-col justify-between min-h-[460px] shadow-2xl relative"
            style={{ boxShadow: "0 0 60px rgba(0, 243, 255, 0.2)" }}
          >
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setShowWizard(false)}
                className="w-7 h-7 rounded-full border border-[#1e1e40] flex items-center justify-center text-gray-500 hover:text-white transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Wizard Steps Slider */}
            {wizardStep === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 animate-slide-up">
                <span className="text-6xl animate-float block mb-1">🔮</span>
                <h3 className="text-2xl font-black uppercase text-[#00f3ff]" style={{ fontFamily: "var(--font-display)", textShadow: "0 0 10px #00f3ff" }}>
                  Neon Merge Drop
                </h3>
                <h4 className="text-xs font-bold text-[#ff00f0] uppercase tracking-wider">
                  The Physics Chaos Arcade
                </h4>
                <p className="text-gray-300 text-xs mt-3 leading-relaxed">
                  Bhai! Canvas par Neon Orbs ko sling/drop karo. Jab do identical orbs aapas mein takrayenge, wo merge hokar larger tier points elements ban jayenge!
                </p>
                <div className="flex items-center gap-2 mt-4 px-3 py-1.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                  <span className="text-sm">🎯</span>
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Goal: Merge up to Level 50!</span>
                </div>
              </div>
            )}

            {wizardStep === 1 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 animate-slide-up">
                <span className="text-6xl animate-float block mb-1">🌋</span>
                <h3 className="text-xl font-black uppercase text-[#ffea00]" style={{ fontFamily: "var(--font-display)" }}>
                  Dynamic Level Chaos
                </h3>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Jaise-jaise score badhega, aapka level up hoga aur game dynamic/chaotic ho jayega:
                </p>
                <ul className="text-left text-[10px] text-gray-400 space-y-1.5 mt-2 max-w-xs font-semibold uppercase tracking-wide">
                  <li className="flex items-center gap-1.5"><span className="text-[#00f3ff]">🚀 Level 1-10:</span> Normal standard physics.</li>
                  <li className="flex items-center gap-1.5"><span className="text-[#10b981]">🟢 Level 11-20:</span> Springy bouncing bubbles.</li>
                  <li className="flex items-center gap-1.5"><span className="text-[#ffea00]">🌊 Level 21-40:</span> **Gravity Tide** (orbs float & sway!).</li>
                  <li className="flex items-center gap-1.5"><span className="text-[#ff007f]">⚠️ Level 41-50:</span> **God Squeeze** (walls contracts!).</li>
                </ul>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5 animate-slide-up">
                <span className="text-6xl animate-float block mb-1">🃏</span>
                <h3 className="text-xl font-black uppercase text-[#ff00f0]" style={{ fontFamily: "var(--font-display)" }}>
                  Fever & Perks Draft
                </h3>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Playing style controls the flow:
                </p>
                <div className="space-y-2 mt-2 w-full text-left">
                  <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20 flex gap-2">
                    <span className="text-lg">🔥</span>
                    <div>
                      <p className="text-[10px] font-black text-[#ff00f0] uppercase leading-none">Neon Fever</p>
                      <p className="text-[9px] text-gray-400 mt-1 leading-snug">Charge meter to enter zero-g 2x multipliers!</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-yellow-950/20 border border-yellow-500/20 flex gap-2">
                    <span className="text-lg">🧲</span>
                    <div>
                      <p className="text-[10px] font-black text-[#ffea00] uppercase leading-none">Roguelike Draft Perks</p>
                      <p className="text-[9px] text-gray-400 mt-1 leading-snug">Choose dynamic modifiers at Level 10, 20, 30, 40! (e.g. Magnetic Pulls, Heavy Drops)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 animate-slide-up">
                <span className="text-6xl animate-float block mb-1">🪙</span>
                <h3 className="text-xl font-black uppercase text-[#10b981]" style={{ fontFamily: "var(--font-display)" }}>
                  Coin Powerups Shop
                </h3>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Earn coin dividends (12% of final score) and invest them inside the match to purchase dynamic lifelines:
                </p>
                <div className="grid grid-cols-3 gap-2 my-2 w-full text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  <div className="p-2 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/25 flex flex-col items-center">
                    <span>☄️ Laser</span>
                    <span className="text-[#ffea00] mt-1">40 🪙</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#eab308]/10 border border-[#eab308]/25 flex flex-col items-center">
                    <span>🌋 Shake</span>
                    <span className="text-[#ffea00] mt-1">60 🪙</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#10b981]/10 border border-[#10b981]/25 flex flex-col items-center">
                    <span>⬆️ Upgrade</span>
                    <span className="text-[#ffea00] mt-1">100 🪙</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pagination controls */}
            <div className="mt-8 flex flex-col items-center gap-5">
              {/* Pagination Dots */}
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      wizardStep === idx ? "w-6 bg-[#00f3ff]" : "bg-[#1e1e40]"
                    }`}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full">
                {wizardStep > 0 && (
                  <button
                    onClick={() => setWizardStep((s) => s - 1)}
                    className="flex-1 py-3 rounded-xl border border-[#1e1e40] text-gray-400 font-bold uppercase tracking-wider text-xs btn-press cursor-pointer"
                  >
                    BACK
                  </button>
                )}
                
                {wizardStep < 3 ? (
                  <button
                    onClick={() => setWizardStep((s) => s + 1)}
                    className="flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs btn-press text-[#06060f]"
                    style={{ background: "linear-gradient(135deg, #00f3ff, #ff00f0)" }}
                  >
                    NEXT
                  </button>
                ) : (
                  <button
                    onClick={() => setShowWizard(false)}
                    className="flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-sm btn-press text-[#06060f]"
                    style={{
                      background: "linear-gradient(135deg, #00f3ff, #ff00f0)",
                      boxShadow: "0 0 25px rgba(0, 243, 255, 0.5)"
                    }}
                  >
                    🚀 LET'S CLASH!
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen Modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6">
          <div
            className="w-full max-w-sm glass-card rounded-3xl border border-[#ff00f0]/30 p-8 text-center animate-winner-appear"
            style={{ boxShadow: "0 0 45px rgba(255, 0, 240, 0.15)" }}
          >
            <span className="text-7xl mb-3 block animate-float">💥</span>
            <h2
              className="text-3xl font-black uppercase text-[#ff007f] tracking-wide animate-pulse"
              style={{ fontFamily: "var(--font-display)", textShadow: "0 0 20px rgba(255,0,127,0.4)" }}
            >
              CONTAINER OVERFLOW
            </h2>
            <p className="text-gray-400 text-xs mt-1.5">Your cyber stacks exceeded the overflow threshold limits.</p>

            <div className="grid grid-cols-2 gap-3 my-6">
              <div className="glass-card rounded-2xl p-3.5 border border-[#1e1e40]">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Score</p>
                <p className="text-white font-black text-2xl mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                  {score}
                </p>
              </div>

              <div className="glass-card rounded-2xl p-3.5 border border-[#ffea00]/20 bg-[#ffea00]/5">
                <p className="text-[9px] text-[#ffea00] uppercase tracking-widest font-black">Level Reached</p>
                <p className="text-[#ffea00] font-black text-2xl mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                  {level}/50
                </p>
              </div>
            </div>

            {/* Claim details bounty */}
            <div className="bg-[#ffea00]/5 border border-[#ffea00]/25 rounded-2xl px-4 py-3 flex items-center justify-between mb-8">
              <div className="flex items-center gap-1.5">
                <span className="text-xl">🪙</span>
                <div className="text-left">
                  <p className="text-[10px] text-gray-500 uppercase font-black leading-none">Bounty Coins</p>
                  <p className="text-[#ffea00] font-black text-lg leading-none mt-1">
                    +{Math.min(250, Math.floor(score * 0.12))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 border-l border-[#ffea00]/20 pl-4">
                <span className="text-xl">✨</span>
                <div className="text-left">
                  <p className="text-[10px] text-gray-500 uppercase font-black leading-none">XP Earned</p>
                  <p className="text-[#00f3ff] font-black text-lg leading-none mt-1">
                    +{Math.min(300, Math.floor(score * 0.2) + level * 2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest text-black btn-press cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #00f3ff, #ff00f0)",
                  boxShadow: "0 0 25px rgba(0, 243, 255, 0.4)"
                }}
              >
                🎮 PLAY AGAIN
              </button>

              <Link
                href="/"
                className="w-full py-3.5 rounded-2xl font-black text-md uppercase tracking-wider glass-card border border-[#1e1e40] text-gray-400 hover:text-white transition-all btn-press text-center cursor-pointer"
              >
                🏠 BACK TO HUB
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Roguelike draft perks Choice Overlays Modal */}
      {draftOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-5">
          <div
            className="w-full max-w-sm glass-card rounded-3xl border border-[#ffea00]/30 p-7 text-center animate-pop-in"
            style={{ boxShadow: "0 0 50px rgba(255, 234, 0, 0.15)" }}
          >
            <span className="text-6xl mb-3 block animate-float">🃏</span>
            <h2
              className="text-2xl font-black uppercase text-[#ffea00] tracking-wide leading-none"
              style={{ fontFamily: "var(--font-display)", textShadow: "0 0 15px rgba(255,234,0,0.4)" }}
            >
              Choose Your Perk!
            </h2>
            <p className="text-gray-400 text-[10px] uppercase font-bold mt-2 mb-6">
              Level {level - 1} Complete! Select 1 modifier to draft:
            </p>

            <div className="space-y-3">
              {draftChoices.map((perk) => (
                <button
                  key={perk.id}
                  onClick={() => claimPerkDraft(perk.id)}
                  className="w-full p-3.5 rounded-2xl glass-card border border-[#1e1e40] hover:border-[#ffea00]/60 hover:bg-[#ffea00]/5 flex items-center gap-3.5 text-left transition-all btn-press cursor-pointer"
                >
                  <span className="text-3xl filter drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]">
                    {perk.emoji}
                  </span>
                  <div>
                    <h4 className="font-black text-sm uppercase text-[#e8e8ff] tracking-wide">
                      {perk.name}
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                      {perk.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Combat float animations stylesheet */}
      <style>{`
        @keyframes float-up {
          0% { transform: translate(-50%, -50%) translateY(0) scale(0.85); opacity: 1; }
          100% { transform: translate(-50%, -50%) translateY(-65px) scale(1.15); opacity: 0; }
        }
        .floating-combat-text {
          position: absolute;
          pointer-events: none;
          font-family: var(--font-display), sans-serif;
          font-weight: 900;
          font-size: 13px;
          text-shadow: 0 0 6px rgba(0,0,0,0.95), 0 0 10px currentColor;
          animation: float-up 1.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
          z-index: 35;
        }
        @keyframes container-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-3px, 2px) rotate(-0.5deg); }
          30% { transform: translate(3px, -2px) rotate(0.5deg); }
          50% { transform: translate(-2px, -3px) rotate(-0.5deg); }
          70% { transform: translate(2px, 3px) rotate(0.5deg); }
          90% { transform: translate(-1px, 2px) rotate(0deg); }
        }
        .animate-screen-shake {
          animation: container-shake 0.35s ease-in-out infinite;
        }
        .vertical-text {
          writing-mode: vertical-lr;
        }
      `}</style>
    </div>
  );
}
