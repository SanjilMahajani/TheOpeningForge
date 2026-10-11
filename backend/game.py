"""In-memory game/session management for Opening Forge's training drills."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal
from uuid import uuid4

import chess

from lines import LINES

Status = Literal["in_progress", "success", "complete", "off_line"]


@dataclass
class Session:
    line: dict
    board: chess.Board = field(default_factory=chess.Board)
    white_index: int = 0
    completed_white_moves: set[str] = field(default_factory=set)
    status: Status = "in_progress"


sessions: dict[str, Session] = {}


def create_session(line: dict) -> tuple[str, Session]:
    session_id = str(uuid4())
    session = Session(line=line)
    sessions[session_id] = session
    return session_id, session


def get_session(session_id: str) -> Session | None:
    return sessions.get(session_id)


def snapshot(session: Session) -> dict:
    history = _history(session.board)
    state = {
        "fen": session.board.fen(),
        "pgn": history[-1]["pgn"],
        "history": history,
        "status": session.status,
        "move_number": session.white_index + 1,
        "can_continue": session.status == "in_progress" and session.board.turn == chess.WHITE,
    }
    if session.board.is_checkmate():
        last_move = session.board.peek()
        state["checkmate"] = {
            "king_square": chess.square_name(session.board.king(session.board.turn)),
            "winner_square": chess.square_name(last_move.to_square),
        }
    return state


def get_legal_moves(session: Session) -> list[str]:
    """Return legal moves that keep the current opening exercise on its line."""
    if session.status != "in_progress":
        return []
    return guide(session)


def guide(session: Session) -> list[str]:
    """Moves that preserve at least one route to this line's final target.

    This allows genuine transpositions (for example Nf3/Bc4 in either order)
    but rejects a legal move that would make the scripted continuation fail.
    """
    if session.status != "in_progress":
        return []
    remaining = [move for move in session.line["white_moves"] if move not in session.completed_white_moves]
    cache: dict[tuple[str, tuple[str, ...], int], bool] = {}
    safe_moves: list[str] = []
    for move_uci in remaining:
        move = chess.Move.from_uci(move_uci)
        if move not in session.board.legal_moves:
            continue
        session.board.push(move)
        if _can_finish_line(session, remaining, move_uci, session.white_index, cache):
            safe_moves.append(move_uci)
        session.board.pop()
    return safe_moves


def _can_finish_line(
    session: Session,
    remaining: list[str],
    played_move: str,
    black_index: int,
    cache: dict[tuple[str, tuple[str, ...], int], bool],
) -> bool:
    """After a candidate White move, determine whether a valid finish exists."""
    remaining_after = [move for move in remaining if move != played_move]
    requires_mate = session.line.get("target") == "checkmate"

    if session.board.is_checkmate():
        return requires_mate and not remaining_after
    if black_index >= len(session.line["black_moves"]):
        return False

    black_move = chess.Move.from_uci(session.line["black_moves"][black_index])
    if black_move not in session.board.legal_moves:
        return False
    session.board.push(black_move)
    try:
        if not remaining_after:
            return not requires_mate

        key = (session.board.fen(), tuple(sorted(remaining_after)), black_index + 1)
        if key in cache:
            return cache[key]

        for next_move_uci in remaining_after:
            next_move = chess.Move.from_uci(next_move_uci)
            if next_move not in session.board.legal_moves:
                continue
            session.board.push(next_move)
            can_finish = _can_finish_line(
                session, remaining_after, next_move_uci, black_index + 1, cache
            )
            session.board.pop()
            if can_finish:
                cache[key] = True
                return True
        cache[key] = False
        return False
    finally:
        session.board.pop()


def play_white_move(session: Session, uci: str) -> tuple[dict, str | None]:
    """Apply a move and the scripted Black reply. Returns state and an error code."""
    if session.status != "in_progress":
        return snapshot(session), "session_finished"

    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        return snapshot(session), "invalid_move_format"

    if move not in session.board.legal_moves:
        return snapshot(session), "illegal_move"

    available_moves = guide(session)
    if move.uci() not in available_moves:
        if move.uci() in session.line["white_moves"]:
            return snapshot(session), "move_not_ready"
        return snapshot(session), "off_line"

    session.board.push(move)
    session.white_index += 1
    session.completed_white_moves.add(move.uci())
    if session.board.is_checkmate():
        session.status = "success"
        return snapshot(session), None

    black_moves = session.line["black_moves"]
    black_index = session.white_index - 1
    if black_index >= len(black_moves):
        session.status = "off_line"
        return snapshot(session), "line_incomplete"

    black_move = chess.Move.from_uci(black_moves[black_index])
    if black_move not in session.board.legal_moves:
        raise RuntimeError("Configured training line contains an illegal Black move")
    session.board.push(black_move)
    if session.white_index == len(session.line["white_moves"]):
        session.status = "complete"
    return snapshot(session), None


def rewind_session(session: Session, ply: int) -> dict:
    """Restore an earlier board position so the player can choose a new branch."""
    if ply < 0 or ply > len(session.board.move_stack):
        raise ValueError("History position is out of range")

    while len(session.board.move_stack) > ply:
        session.board.pop()

    replay = chess.Board()
    completed_white_moves: set[str] = set()
    white_index = 0
    for move in session.board.move_stack:
        if replay.turn == chess.WHITE:
            completed_white_moves.add(move.uci())
            white_index += 1
        replay.push(move)
    session.completed_white_moves = completed_white_moves
    session.white_index = white_index
    session.status = "in_progress"
    return snapshot(session)


def _history(board: chess.Board) -> list[dict]:
    """Replay the move stack into displayable, immutable review positions."""
    replay = chess.Board()
    parts: list[str] = []
    history = [{"fen": replay.fen(), "pgn": "", "turn": "white"}]
    for move in board.move_stack:
        if replay.turn == chess.WHITE:
            parts.append(f"{replay.fullmove_number}. {replay.san(move)}")
        else:
            parts.append(replay.san(move))
        replay.push(move)
        history.append({
            "fen": replay.fen(),
            "pgn": " ".join(parts),
            "turn": "white" if replay.turn == chess.WHITE else "black",
        })
    return history
