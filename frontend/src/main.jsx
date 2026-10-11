import { useEffect, useRef, useState } from "react";
import "../vendor/chessboard/chessboard-1.0.0.min.css";
import { createRoot } from "react-dom/client";
import "./styles.css";

const api = async (url, options) => { const response = await fetch(url, options); if (!response.ok) throw new Error((await response.json()).detail || "Request failed"); return response.json(); };
const coord = (move) => `${move.slice(0, 2)} → ${move.slice(2, 4)}`;

function Board({ fen, moves, canPlay, reviewing, mate, onMove, onResume }) {
  const element = useRef(null); const board = useRef(null); const selected = useRef(null);
  const current = useRef({ moves, canPlay, reviewing, onMove, onResume }); current.current = { moves, canPlay, reviewing, onMove, onResume };
  const clear = () => {
    const root = element.current;
    root?.querySelectorAll(".move-dot,.capture-ring").forEach((node) => node.remove());
    root?.querySelectorAll(".chosen-square").forEach((square) => square.classList.remove("chosen-square"));
  };
  const targets = (from) => current.current.moves.filter((move) => move.startsWith(from)).map((move) => move.slice(2, 4));
  const choose = (from) => { clear(); selected.current = from; const root = element.current; root?.querySelector(`[data-square="${from}"]`)?.classList.add("chosen-square"); targets(from).forEach((to) => { const square = root?.querySelector(`[data-square="${to}"]`); if (!square) return; const marker = document.createElement("span"); marker.className = square.querySelector("[data-piece]") ? "capture-ring" : "move-dot"; square.appendChild(marker); }); };
  useEffect(() => {
    const instance = window.Chessboard(element.current, { draggable: true, position: "start", pieceTheme: "/chessboard/img/chesspieces/wikipedia/{piece}.png", onDragStart: (from, piece) => { if (!current.current.canPlay || piece[0] !== "w") return false; choose(from); return true; }, onDrop: (from, to, piece) => { if (!current.current.canPlay || piece[0] !== "w") return "snapback"; if (from === to) { choose(from); return "snapback"; } selected.current = null; clear(); current.current.onMove(from, to); return undefined; } });
    board.current = instance;
    const click = (event) => { const square = event.target.closest("[data-square]"); if (!square) return; const now = current.current; const name = square.dataset.square; const piece = square.querySelector("[data-piece]")?.dataset.piece; if (!now.canPlay) { if (now.reviewing && piece?.[0] === "w") now.onResume(); return; } if (piece?.[0] === "w") return choose(name); if (selected.current && targets(selected.current).includes(name)) { const from = selected.current; selected.current = null; clear(); instance.move(`${from}-${name}`); now.onMove(from, name); } else { selected.current = null; clear(); } };
    element.current.addEventListener("click", click); return () => element.current?.removeEventListener("click", click);
  }, []);
  useEffect(() => { board.current?.position(fen || "start", false); selected.current = null; clear(); }, [fen]);
  useEffect(() => { const resize = () => board.current?.resize(); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const spot = (square) => ({ left: `${(square.charCodeAt(0) - 96.5) * 12.5}%`, top: `${(8.5 - Number(square[1])) * 12.5}%` });
  return <div className="board-shell"><div ref={element} className="board" aria-label="Chess board" />{mate && <div className="mate-layer"><span className="mate-badge mate" style={spot(mate.king_square)}>Checkmate</span><span className="mate-badge winner" style={spot(mate.winner_square)}>♛ Winner</span></div>}</div>;
}

function App() {
  const [openings, setOpenings] = useState([]), [opening, setOpening] = useState(""), [live, setLive] = useState(null), [index, setIndex] = useState(0), [moves, setMoves] = useState([]), [guideOn, setGuideOn] = useState(false), [guide, setGuide] = useState([]), [message, setMessage] = useState("Choose an opening to begin."), [thinking, setThinking] = useState(false);
  const history = live?.history || [], entry = history[index], reviewing = index < history.length - 1, canPlay = Boolean(live && live.status === "in_progress" && !reviewing && !thinking);
  const apply = (state) => { setLive(state); setIndex((state.history?.length || 1) - 1); setMessage(state.status === "success" ? "Checkmate. Beautifully forged." : state.status === "complete" ? "Line complete. Start another drill." : "Your move."); };
  useEffect(() => { api("/openings").then((data) => setOpenings(data.openings)).catch(() => setMessage("Could not load openings.")); }, []);
  useEffect(() => { if (!canPlay || !live) { setMoves([]); return; } api(`/legal-moves?session_id=${encodeURIComponent(live.session_id)}`).then((data) => setMoves(data.moves)).catch(() => setMoves([])); }, [live?.session_id, live?.history?.length, canPlay]);
  useEffect(() => { if (!guideOn || !canPlay || !live) { setGuide([]); return; } api(`/guide?session_id=${encodeURIComponent(live.session_id)}`).then((data) => setGuide(data.moves)).catch(() => setGuide([])); }, [guideOn, canPlay, live?.session_id, live?.history?.length]);
  const start = async (selected = opening) => { if (!selected) return setMessage("Select an opening first."); setThinking(true); try { apply(await api("/new-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opening_name: selected }) })); } catch { setMessage("Could not start the line."); } finally { setThinking(false); } };
  const play = async (from, to) => { if (!live || !canPlay) return; setThinking(true); try { const state = await api("/move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: live.session_id, move: `${from}${to}` }) }); if (state.error) { apply(state); setMessage("That move is outside this opening line."); return; } if (state.status !== "success") { setMessage("Black is thinking…"); await new Promise((done) => setTimeout(done, 850)); } apply(state); } catch (error) { setMessage(error.message); } finally { setThinking(false); } };
  const resume = async () => { if (!live || !reviewing || entry?.turn !== "white") return; setThinking(true); try { apply(await api("/rewind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: live.session_id, ply: index }) })); setMessage("Position restored. Choose a new move."); } catch (error) { setMessage(error.message); } finally { setThinking(false); } };
  const label = !history.length ? "No active line" : reviewing ? `Viewing ply ${index} of ${history.length - 1}` : "Live position";
  return <main className="app"><header><p className="eyebrow">PRACTICE • RECALL • FORGE</p><h1>Opening <i>Forge</i></h1><p>Build opening instincts, one position at a time.</p></header><section className="workbench"><Board fen={entry?.fen} moves={moves} canPlay={canPlay} reviewing={reviewing} mate={!reviewing ? live?.checkmate : null} onMove={play} onResume={resume} /><aside className="panel"><label className="field"><span>Opening drill</span><select value={opening} onChange={(event) => { setOpening(event.target.value); start(event.target.value); }}><option value="">Choose an opening</option>{openings.map((name) => <option key={name}>{name}</option>)}</select></label><div className="status"><span className="pulse" />{message}</div><label className="toggle"><input type="checkbox" checked={guideOn} onChange={(event) => setGuideOn(event.target.checked)} /><span>Show move guide</span></label>{guideOn && <p className="guide">{guide.length ? guide.map(coord).join("  ·  ") : "—"}</p>}<div className="moves"><span>Move history</span><p>{entry?.pgn || "—"}</p></div><div className="history"><button disabled={index <= 0} onClick={() => setIndex(index - 1)}>←</button><div><b>{label}</b><small>{reviewing && entry?.turn === "white" ? "Click a White piece to branch here" : ""}</small></div><button disabled={index >= history.length - 1} onClick={() => setIndex(index + 1)}>→</button></div><button className="new-line" onClick={() => start()} disabled={!opening || thinking}>New line</button></aside></section></main>;
}
createRoot(document.getElementById("root")).render(<App />);
