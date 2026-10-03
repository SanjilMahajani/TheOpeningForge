/* global Chessboard */
let board;
let sessionId;
let currentStatus = "in_progress";
let movePending = false;
let legalMoves = []; // Store legal moves from current position
let selectedSquare = null;
let ignoreBoardClickUntil = 0;

const statusEl = document.querySelector("#status");
const openingSelect = document.querySelector("#opening-select");
const hintEl = document.querySelector("#hint");
const pgnEl = document.querySelector("#pgn");
const guideToggle = document.querySelector("#guide-toggle");
const mateOverlay = document.querySelector("#mate-overlay");
const checkmateBadge = document.querySelector("#checkmate-badge");
const winnerBadge = document.querySelector("#winner-badge");

async function populateOpenings() {
  try {
    const data = await request("/openings");
    openingSelect.innerHTML =
      '<option value="">-- Select an Opening --</option>' +
      data.openings.map(o => `<option value="${o}">${o}</option>`).join("");
  } catch (error) {
    console.error("Failed to load openings", error);
  }
}

function uci(source, target) {
  return `${source}${target}`;
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error((await response.json()).detail || "Request failed");
  return response.json();
}

// Fetch legal moves from the server
async function fetchLegalMoves() {
  if (!sessionId || currentStatus !== "in_progress") {
    legalMoves = [];
    return;
  }
  try {
    const data = await request(`/legal-moves?session_id=${encodeURIComponent(sessionId)}`);
    legalMoves = data.moves;
  } catch (error) {
    legalMoves = [];
  }
}

// Get target squares for a specific piece type from selected square
function getMovesFromSquare(sourceSquare) {
  return legalMoves
    .filter(move => move.startsWith(sourceSquare))
    .map(move => move.slice(2, 4));
}

// Place a chess.com-style move marker directly inside its destination square.
function createDot(square) {
  const dot = document.createElement("div");
  const targetEl = document.querySelector(`#board [data-square="${square}"]`);
  if (!targetEl) return;
  dot.className = targetEl.querySelector("[data-piece]")
    ? "legal-move-dot legal-capture-ring"
    : "legal-move-dot";
  targetEl.appendChild(dot);
}

// Show legal move dots for the selected piece
function showLegalMoves(sourceSquare) {
  clearDots();
  const targets = getMovesFromSquare(sourceSquare);
  targets.forEach(target => createDot(target));
}

// Clear all legal move dots
function clearDots() {
  document.querySelectorAll(".legal-move-dot").forEach(dot => dot.remove());
}

// Get piece at a square from FEN
function getPieceAtSquare(fen, square) {
  const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
  const rank = parseInt(square[1]) - 1; // 1=0, 2=1, etc.
  const rows = fen.split(" ")[0].split("/");
  let rankIndex = 7 - rank;
  let fileIndex = 0;
  for (const char of rows[rankIndex]) {
    if (/\d/.test(char)) {
      fileIndex += parseInt(char);
    } else {
      if (fileIndex === file) {
        return char;
      }
      fileIndex++;
    }
  }
  return null;
}

function describeStatus(state, error) {
  if (error === "illegal_move") return "That move is illegal. Try another move.";
  if (error === "invalid_move_format") return "That move could not be read. Try again.";
  if (error === "session_finished") return "This line has already finished. Start a new one.";
  if (state.status === "success") return "Checkmate! Nicely executed.";
  if (state.status === "complete") return "Opening line complete! Start a new line to keep training.";
  if (state.status === "off_line") return "That leaves the training line. Try a new line.";
  return "Your move — find the next attacking idea.";
}

function squarePosition(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return {
    x: `${((file + 0.5) / 8) * 100}%`,
    y: `${((8.5 - rank) / 8) * 100}%`,
  };
}

function renderMateOverlay(checkmate) {
  if (!checkmate) {
    mateOverlay.hidden = true;
    return;
  }
  const king = squarePosition(checkmate.king_square);
  const winner = squarePosition(checkmate.winner_square);
  checkmateBadge.style.setProperty("--x", king.x);
  checkmateBadge.style.setProperty("--y", king.y);
  winnerBadge.style.setProperty("--x", winner.x);
  winnerBadge.style.setProperty("--y", winner.y);
  mateOverlay.hidden = false;
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
  renderMateOverlay(state.checkmate);
  statusEl.textContent = describeStatus(state, error);
  pgnEl.textContent = state.pgn || "—";
  clearDots();
  fetchLegalMoves();
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

    // The dropped White piece is already on the board. Leave it visible while
    // Black's reply is delayed, then render the server-authoritative position.
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
  // A click is reported by chessboard.js as a drag dropped on its source.
  // Keep the selected piece and its dots visible in that case.
  if (source === target) {
    selectedSquare = source;
    showLegalMoves(source);
    return "snapback";
  }
  ignoreBoardClickUntil = Date.now() + 250;
  movePending = true;
  selectedSquare = null;
  clearDots();
  submitMove(source, target);
  // Keep the White move on screen while the server validates it. If rejected,
  // render() restores the authoritative position.
  return undefined;
}

async function newGame() {
  const opening_name = openingSelect.value;
  if (!opening_name) {
    statusEl.textContent = "Please select an opening first.";
    return;
  }
  movePending = false;
  statusEl.textContent = "Setting up a new line…";
  hintEl.textContent = "";
  try {
    const state = await request("/new-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opening_name }),
    });
    sessionId = state.session_id;
    render(state);
  } catch (error) {
    statusEl.textContent = "Could not start a game. Is the server running?";
  }
}

openingSelect.addEventListener("change", newGame);
document.querySelector("#new-game").addEventListener("click", newGame);
guideToggle.addEventListener("change", updateGuide);

board = Chessboard("board", {
  draggable: true,
  position: "start",
  onDrop,
  onDragStart: (source, piece) => {
    if (currentStatus !== "in_progress" || movePending || piece[0] !== "w") return false;
    selectedSquare = source;
    showLegalMoves(source);
    return true;
  },
  pieceTheme: "/static/vendor/chessboard/img/chesspieces/wikipedia/{piece}.png",
});
document.querySelector("#board").addEventListener("click", (event) => {
  if (Date.now() < ignoreBoardClickUntil) return;
  const squareEl = event.target.closest("[data-square]");
  if (!squareEl || currentStatus !== "in_progress" || movePending) return;

  const square = squareEl.dataset.square;
  const piece = getPieceAtSquare(board.fen(), square);
  if (piece?.[0] === "w") {
    selectedSquare = square;
    showLegalMoves(square);
    return;
  }

  if (selectedSquare && getMovesFromSquare(selectedSquare).includes(square)) {
    const source = selectedSquare;
    // Click-to-move has no native board drag, so place the piece optimistically.
    board.move(`${source}-${square}`);
    movePending = true;
    selectedSquare = null;
    clearDots();
    submitMove(source, square);
    return;
  }

  selectedSquare = null;
  clearDots();
});
async function init() {
  await populateOpenings();
  statusEl.textContent = "Select an opening and click 'New line' to begin.";
}

window.addEventListener("resize", () => board.resize());
init();
