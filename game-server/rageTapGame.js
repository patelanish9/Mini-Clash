// Server-side Rage Tap Game Engine (100ms Tick-Rate Batching & Adaptive AI Bot Engine)

const GAME_DURATION = 15;
const MAX_POS = 100;
const TAP_FORCE = 2;

// Active games store
const activeRageGames = new Map();

export function initRageTapGame(io, roomId, p1, p2, stake) {
  cleanRageGame(roomId);

  const game = {
    roomId,
    position: 50,
    timeLeft: GAME_DURATION,
    p1Taps: 0,
    p2Taps: 0,
    players: {
      1: p1.socketId,
      2: p2.socketId
    },
    profiles: {
      1: p1.profile,
      2: p2.profile
    },
    tapsBuffer: {
      1: 0,
      2: 0
    },
    stake,
    phase: "countdown",
    countdown: 3,
    tickInterval: null,
    secondInterval: null,
    countdownTimer: null
  };

  activeRageGames.set(roomId, game);

  // Notify P1 (always human)
  io.to(p1.socketId).emit("match_found", {
    roomId,
    opponent: p2.profile,
    role: 1, // Player 1 (Bottom half)
    stake
  });

  // Notify P2 (if human)
  if (!p2.isBot) {
    io.to(p2.socketId).emit("match_found", {
      roomId,
      opponent: p1.profile,
      role: 2, // Player 2 (Top half)
      stake
    });
  }

  startCountdown(io, roomId);
}

function startCountdown(io, roomId) {
  const game = activeRageGames.get(roomId);
  if (!game) return;

  const runCountdownStep = () => {
    if (game.countdown < 0) {
      startGameplay(io, roomId);
      return;
    }

    io.to(roomId).emit("countdown_step", { countdown: game.countdown });
    game.countdown--;
    game.countdownTimer = setTimeout(runCountdownStep, 1000);
  };

  runCountdownStep();
}

function startGameplay(io, roomId) {
  const game = activeRageGames.get(roomId);
  if (!game) return;

  game.phase = "playing";
  io.to(roomId).emit("game_start");

  // Tick rate interval - every 100ms
  game.tickInterval = setInterval(() => {
    processGameTick(io, roomId);
  }, 100);

  // Timer interval - every 1 second
  game.secondInterval = setInterval(() => {
    processSecond(io, roomId);
  }, 1000);
}

export function handleRageTap(io, roomId, socketId, tapCount) {
  const game = activeRageGames.get(roomId);
  if (!game || game.phase !== "playing") return;

  const playerRole = game.players[1] === socketId ? 1 : game.players[2] === socketId ? 2 : null;
  if (!playerRole) return;

  // Add client taps into the buffer to be processed on the next server 100ms tick
  const validTaps = Math.min(12, Math.max(0, tapCount));
  game.tapsBuffer[playerRole] += validTaps;
}

function processGameTick(io, roomId) {
  const game = activeRageGames.get(roomId);
  if (!game || game.phase !== "playing") return;

  // Inject AI Bot taps into tick buffer if Player 2 is a Bot
  if (game.players[2] && game.players[2].startsWith("bot_")) {
    // Adaptive AI Difficulty: taps faster (65% probability) if human (P1) is leading,
    // and base speed (45% probability) if bot is leading.
    const botAggression = game.position > 58 ? 0.65 : 0.45;
    if (Math.random() < botAggression) {
      // Inject 1 tap (equates to ~4.5 to ~6.5 taps per second)
      game.tapsBuffer[2] += 1;
    }
  }

  // Read buffers
  const p1TapsThisTick = game.tapsBuffer[1];
  const p2TapsThisTick = game.tapsBuffer[2];

  // Reset buffers
  game.tapsBuffer[1] = 0;
  game.tapsBuffer[2] = 0;

  // Accumulate total taps
  game.p1Taps += p1TapsThisTick;
  game.p2Taps += p2TapsThisTick;

  // Tug-of-war physics:
  // Player 1 taps move position right (increase value)
  // Player 2 taps move position left (decrease value)
  const p1Move = p1TapsThisTick * TAP_FORCE;
  const p2Move = p2TapsThisTick * TAP_FORCE;

  game.position = game.position + p1Move - p2Move;

  // Clamp position between 0 and 100
  game.position = Math.max(0, Math.min(MAX_POS, game.position));

  // Sync to client
  io.to(roomId).emit("state_sync", {
    position: game.position,
    p1Taps: game.p1Taps,
    p2Taps: game.p2Taps
  });

  // Check instant win (tug end nodes hit)
  if (game.position >= MAX_POS) {
    endGame(io, roomId, 1);
  } else if (game.position <= 0) {
    endGame(io, roomId, 2);
  }
}

function processSecond(io, roomId) {
  const game = activeRageGames.get(roomId);
  if (!game || game.phase !== "playing") return;

  game.timeLeft--;

  io.to(roomId).emit("timer_sync", { timeLeft: game.timeLeft });

  if (game.timeLeft <= 0) {
    // Time expired: check who has the tug-of-war advantage (50 is center)
    const winnerRole = game.position >= 50 ? 1 : 2;
    endGame(io, roomId, winnerRole);
  }
}

function endGame(io, roomId, winnerRole) {
  const game = activeRageGames.get(roomId);
  if (!game) return;

  game.phase = "won";
  clearRageGameIntervals(roomId);

  // Generate safe session token for local economy coins update
  const token = Buffer.from(JSON.stringify({
    roomId,
    winner: winnerRole,
    stake: game.stake,
    timestamp: Date.now()
  })).toString("base64");

  io.to(roomId).emit("game_over", {
    winner: winnerRole,
    reward: game.stake,
    token
  });

  cleanRageGame(roomId);
}

function clearRageGameIntervals(roomId) {
  const game = activeRageGames.get(roomId);
  if (game) {
    if (game.tickInterval) clearInterval(game.tickInterval);
    if (game.secondInterval) clearInterval(game.secondInterval);
    if (game.countdownTimer) clearTimeout(game.countdownTimer);
    game.tickInterval = null;
    game.secondInterval = null;
    game.countdownTimer = null;
  }
}

export function cleanRageGame(roomId) {
  clearRageGameIntervals(roomId);
  activeRageGames.delete(roomId);
}

export function handleRageDisconnect(io, roomId, socketId) {
  const game = activeRageGames.get(roomId);
  if (!game) return;

  clearRageGameIntervals(roomId);

  const disconnectedRole = game.players[1] === socketId ? 1 : 2;
  const remainingRole = disconnectedRole === 1 ? 2 : 1;
  const remainingSocketId = game.players[remainingRole];

  if (remainingSocketId && !remainingSocketId.startsWith("bot_")) {
    const token = Buffer.from(JSON.stringify({
      roomId,
      winner: remainingRole,
      stake: game.stake,
      timestamp: Date.now()
    })).toString("base64");

    io.to(remainingSocketId).emit("opponent_left", {
      winner: remainingRole,
      reward: game.stake,
      token
    });
  }

  cleanRageGame(roomId);
}
