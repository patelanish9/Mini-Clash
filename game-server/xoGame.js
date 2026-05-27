// Server-side XO Speedrun Game Engine (Anti-Cheat Referee & Tactical Bot Engine)

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinner(board) {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

// Active game rooms cache
const activeXOGames = new Map();

export function initXOGame(io, roomId, p1, p2, stake) {
  // Clear any existing game on this room
  clearXOGameTimeout(roomId);

  const game = {
    roomId,
    board: Array(9).fill(null),
    currentPlayer: "X",
    players: {
      X: p1.socketId,
      O: p2.socketId
    },
    profiles: {
      X: p1.profile,
      O: p2.profile
    },
    stake,
    turnTimer: null,
    turnStartedAt: Date.now()
  };

  activeXOGames.set(roomId, game);

  // Notify P1 (always human)
  io.to(p1.socketId).emit("match_found", {
    roomId,
    opponent: p2.profile,
    role: "X",
    stake
  });

  // Notify P2 (if human)
  if (!p2.isBot) {
    io.to(p2.socketId).emit("match_found", {
      roomId,
      opponent: p1.profile,
      role: "O",
      stake
    });
  }

  startTurnTimer(io, roomId);
}

function clearXOGameTimeout(roomId) {
  const game = activeXOGames.get(roomId);
  if (game && game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
}

export function cleanXOGame(roomId) {
  clearXOGameTimeout(roomId);
  activeXOGames.delete(roomId);
}

function startTurnTimer(io, roomId) {
  clearXOGameTimeout(roomId);
  const game = activeXOGames.get(roomId);
  if (!game) return;

  game.turnStartedAt = Date.now();
  
  // Check if current turn is a Bot!
  const currentSocketId = game.players[game.currentPlayer];
  if (currentSocketId && currentSocketId.startsWith("bot_")) {
    triggerBotMove(io, roomId);
    return;
  }

  // Set 3 seconds shot clock for humans
  game.turnTimer = setTimeout(() => {
    handleTimeExpire(io, roomId);
  }, 3200); // 3200ms is buffer for latency
}

function handleTimeExpire(io, roomId) {
  const game = activeXOGames.get(roomId);
  if (!game) return;

  // Switch turns
  const previousPlayer = game.currentPlayer;
  game.currentPlayer = previousPlayer === "X" ? "O" : "X";
  
  // Broadcast turn expired/switched
  io.to(roomId).emit("state_sync", {
    board: game.board,
    currentPlayer: game.currentPlayer,
    expiredPlayer: previousPlayer
  });

  startTurnTimer(io, roomId);
}

// Smart Heuristics Bot Mover
function triggerBotMove(io, roomId) {
  const game = activeXOGames.get(roomId);
  if (!game) return;

  const botSocketId = game.players[game.currentPlayer];
  const botRole = game.currentPlayer;
  const humanRole = botRole === "X" ? "O" : "X";

  // Scan empty cells
  const emptyCells = [];
  game.board.forEach((cell, idx) => {
    if (cell === null) emptyCells.push(idx);
  });

  if (emptyCells.length === 0) return;

  let selectedCellIndex = null;

  // 1. Check if Bot can win instantly
  for (const cellIdx of emptyCells) {
    const tempBoard = [...game.board];
    tempBoard[cellIdx] = botRole;
    if (checkWinner(tempBoard)) {
      selectedCellIndex = cellIdx;
      break;
    }
  }

  // 2. Check if Bot needs to block human from winning
  if (selectedCellIndex === null) {
    for (const cellIdx of emptyCells) {
      const tempBoard = [...game.board];
      tempBoard[cellIdx] = humanRole;
      if (checkWinner(tempBoard)) {
        selectedCellIndex = cellIdx;
        break;
      }
    }
  }

  // 3. Prefer Center cell (index 4)
  if (selectedCellIndex === null && emptyCells.includes(4)) {
    selectedCellIndex = 4;
  }

  // 4. Prefer Corners: [0, 2, 6, 8]
  if (selectedCellIndex === null) {
    const corners = [0, 2, 6, 8].filter(idx => emptyCells.includes(idx));
    if (corners.length > 0) {
      selectedCellIndex = corners[Math.floor(Math.random() * corners.length)];
    }
  }

  // 5. Fallback to random empty cell
  if (selectedCellIndex === null) {
    selectedCellIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  // Simulate human thinking latency (1 to 1.5 seconds)
  setTimeout(() => {
    // Force call handler moves
    handleXOMove(io, roomId, botSocketId, selectedCellIndex);
  }, 1000 + Math.random() * 500);
}

export function handleXOMove(io, roomId, socketId, cellIndex) {
  const game = activeXOGames.get(roomId);
  if (!game) return;

  // Validate player turn
  const playerRole = game.players.X === socketId ? "X" : game.players.O === socketId ? "O" : null;
  if (!playerRole) return; // Spectator or outsider

  if (game.currentPlayer !== playerRole) {
    return; // Not their turn
  }

  // Validate cell index
  if (cellIndex < 0 || cellIndex > 8 || game.board[cellIndex] !== null) {
    return; // Invalid cell
  }

  // Apply move on the server
  game.board[cellIndex] = playerRole;

  // Check winner
  const win = checkWinner(game.board);
  if (win) {
    clearXOGameTimeout(roomId);
    
    // Server confirms victory, generate temporary coin transaction token
    const token = Buffer.from(JSON.stringify({
      roomId,
      winner: playerRole,
      stake: game.stake,
      timestamp: Date.now()
    })).toString("base64");

    io.to(roomId).emit("game_over", {
      winner: playerRole,
      isDraw: false,
      winningLine: win.line,
      board: game.board,
      reward: game.stake,
      token
    });
    cleanXOGame(roomId);
    return;
  }

  // Check draw
  if (game.board.every(cell => cell !== null)) {
    clearXOGameTimeout(roomId);
    io.to(roomId).emit("game_over", {
      winner: null,
      isDraw: true,
      board: game.board,
      reward: 0
    });
    cleanXOGame(roomId);
    return;
  }

  // Next turn
  game.currentPlayer = playerRole === "X" ? "O" : "X";
  
  io.to(roomId).emit("state_sync", {
    board: game.board,
    currentPlayer: game.currentPlayer
  });

  startTurnTimer(io, roomId);
}

export function handleXODisconnect(io, roomId, socketId) {
  const game = activeXOGames.get(roomId);
  if (!game) return;

  clearXOGameTimeout(roomId);

  // Identify who disconnected and who is remaining
  const disconnectedRole = game.players.X === socketId ? "X" : "O";
  const remainingRole = disconnectedRole === "X" ? "O" : "X";
  const remainingSocketId = game.players[remainingRole];

  // If the remaining socket is human (doesn't start with bot_)
  if (remainingSocketId && !remainingSocketId.startsWith("bot_")) {
    // Session token for safe coins transfer
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

  cleanXOGame(roomId);
}
