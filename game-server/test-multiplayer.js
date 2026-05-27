// Automated Integration Test for Mini Clash V3 Multiplayer Server
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

console.log("==================================================");
console.log("🧪 STARTING MULTIPLAYER SYSTEM INTEGRATION TEST...");
console.log("==================================================");

// Initialize two client connections
const p1Socket = io(SERVER_URL, { transports: ["websocket"], forceNew: true });
const p2Socket = io(SERVER_URL, { transports: ["websocket"], forceNew: true });

let p1Role = null;
let p2Role = null;
let p1Opponent = null;
let p2Opponent = null;
let gameRoomId = null;
let testsPassed = 0;

function checkAssertions() {
  if (testsPassed === 5) {
    console.log("\n==================================================");
    console.log("🎉 ALL MULTIPLAYER INTEGRATION TESTS PASSED CLEANLY!");
    console.log("==================================================");
    cleanupAndExit(0);
  }
}

function cleanupAndExit(code) {
  p1Socket.disconnect();
  p2Socket.disconnect();
  setTimeout(() => {
    process.exit(code);
  }, 500);
}

// Timeout backup in case server is not running or tests hang
const backupTimeout = setTimeout(() => {
  console.error("❌ TEST FAILED: Matchmaking test timed out.");
  cleanupAndExit(1);
}, 6000);

p1Socket.on("connect", () => {
  console.log("✔ Player 1 connected to server.");
  triggerMatchmaking();
});

p2Socket.on("connect", () => {
  console.log("✔ Player 2 connected to server.");
  triggerMatchmaking();
});

let connectionsReady = 0;
function triggerMatchmaking() {
  connectionsReady++;
  if (connectionsReady < 2) return;

  console.log("\n📡 Initiating Online Matchmaking for XO Speedrun...");
  
  p1Socket.emit("find_match", {
    gameType: "xo",
    profile: { name: "Player 1 (Tester)", avatarEmoji: "⚡", avatarGlowColor: "#00f3ff" }
  });

  p2Socket.emit("find_match", {
    gameType: "xo",
    profile: { name: "Player 2 (Tester)", avatarEmoji: "👊", avatarGlowColor: "#ff00f0" }
  });
}

// Listeners for Player 1
p1Socket.on("match_found", (data) => {
  p1Role = data.role;
  p1Opponent = data.opponent;
  gameRoomId = data.roomId;
  console.log(`\n🎮 [Match Found] Player 1 joined room: ${data.roomId}`);
  console.log(`   Role: ${data.role} | Opponent: ${data.opponent.name}`);
  
  if (p1Role === "X" && p1Opponent.name === "Player 2 (Tester)") {
    testsPassed++;
    console.log("✔ Test 1 passed: Player 1 matchmaking & role assignment correct.");
    checkAssertions();
  }
});

p1Socket.on("state_sync", (data) => {
  console.log("📡 Player 1 received board sync:", data.board);
  if (data.board[4] === "X" && data.currentPlayer === "O") {
    testsPassed++;
    console.log("✔ Test 3 passed: Move registered, verified, and broadcasted by server referee.");
    checkAssertions();
    
    // Player 2 is O, now Player 2 makes a move on cell index 0
    console.log("\n🎯 Player 2 (O) making move on cell index 0...");
    p2Socket.emit("player_action", {
      action: "make_move",
      payload: { cellIndex: 0 }
    });
  }
});

// Listeners for Player 2
p2Socket.on("match_found", (data) => {
  p2Role = data.role;
  p2Opponent = data.opponent;
  console.log(`🎮 [Match Found] Player 2 joined room: ${data.roomId}`);
  console.log(`   Role: ${data.role} | Opponent: ${data.opponent.name}`);

  if (p2Role === "O" && p2Opponent.name === "Player 1 (Tester)") {
    testsPassed++;
    console.log("✔ Test 2 passed: Player 2 matchmaking & role assignment correct.");
    checkAssertions();

    // Trigger turn 1: Player 1 (X) makes a move on cell index 4
    setTimeout(() => {
      console.log("\n🎯 Player 1 (X) making move on cell index 4...");
      p1Socket.emit("player_action", {
        action: "make_move",
        payload: { cellIndex: 4 }
      });
    }, 500);
  }
});

p2Socket.on("state_sync", (data) => {
  console.log("📡 Player 2 received board sync:", data.board);
  if (data.board[0] === "O" && data.currentPlayer === "X") {
    testsPassed++;
    console.log("✔ Test 4 passed: Player 2 move successfully synced.");
    checkAssertions();

    // Now test unexpected disconnect: Disconnect Player 2, Player 1 should receive win
    console.log("\n🔌 Simulating unexpected disconnect: Disconnecting Player 2...");
    p2Socket.disconnect();
  }
});

p1Socket.on("opponent_left", (data) => {
  console.log(`\n🚨 [Opponent Left] Player 1 notified that opponent left room.`);
  console.log(`   Winner Declared: Player ${data.winner}`);
  console.log(`   Security Coin Verification Token Issued: ${data.token.substring(0, 20)}...`);

  if (data.winner === "X" && data.token) {
    clearTimeout(backupTimeout);
    testsPassed++;
    console.log("✔ Test 5 passed: Disconnect auto-win & security coin validation succeeded.");
    checkAssertions();
  }
});
