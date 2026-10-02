/* global Chessboard */
let board;
let sessionId;
let currentStatus = "in_progress";
let movePending = false;

const statusEl = document.querySelector("#status");
const hintEl = document.querySelector("#hint");
const pgnEl = document.querySelector("#pgn");
const guideToggle = document.querySelector("#guide-toggle");

function uci(source, target) {
  return `${source}${target}`;
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error((await response.json()).detail || "Request failed");
  return response.json();
}

function describeStatus(state, error) {
  if (error === "illegal_move") return "That move is illegal. Try another move.";
  if (error === "invalid_move_format") return "That move could not be read. Try again.";
  if (error === "session_finished") return "This line has already finished. Start a new one.";
  if (state.status === "success") return "Checkmate! Nicely executed.";
  if (state.status === "off_line") return "That leaves the training line. Try a new line.";
  return "Your move — find the next attacking idea.";
}

async function updateGuide() {
  hintEl.textContent = "";
  if (!guideToggle.checked || !sessionId || currentStatus !== "in_progress") return;
  try {
    const { moves } = await request(`/guide?session_id=${encodeURIComponent(sessionId)}`);
    if (moves.length) {
      const formatted = moves.map((move) => `${move.slice(0, 2)} → ${move.slice(2, 4)}`);
      hintEl.textContent = `Guide: ${formatted.join(" or ")}`;
    }
  } catch (error) {
    hintEl.textContent = "Guide unavailable.";
  }
}

function render(state, error = null) {
  currentStatus = state.status;
  board.position(state.fen, false);
  statusEl.textContent = describeStatus(state, error);
  pgnEl.textContent = state.pgn || "—";
  updateGuide();
}

async function submitMove(source, target) {
  try {
    const state = await request("/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, move: uci(source, target) }),
    });
    if (state.error || state.status === "success") {
      render(state, state.error);
      return;
    }

    // The server has accepted the White move. Show it before Black replies.
    board.move(`${source}-${target}`);
    statusEl.textContent = "Black is thinking…";
    hintEl.textContent = "";
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    render(state);
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    movePending = false;
  }
}

function onDrop(source, target, piece) {
  if (currentStatus !== "in_progress" || movePending || piece[0] !== "w") return "snapback";
  // chessboard.js expects an immediate return value; the authoritative board
  // position arrives from the server after its legality and line checks.
  movePending = true;
  submitMove(source, target);
  return "snapback";
}

async function newGame() {
  movePending = false;
  statusEl.textContent = "Setting up a new line…";
  hintEl.textContent = "";
  try {
    const state = await request("/new-session", { method: "POST" });
    sessionId = state.session_id;
    render(state);
  } catch (error) {
    statusEl.textContent = "Could not start a game. Is the server running?";
  }
}

document.querySelector("#new-game").addEventListener("click", newGame);
guideToggle.addEventListener("change", updateGuide);
board = Chessboard("board", {
  draggable: true,
  position: "start",
  onDrop,
  pieceTheme: "/static/vendor/chessboard/img/chesspieces/wikipedia/{piece}.png",
});
window.addEventListener("resize", () => board.resize());
newGame();
