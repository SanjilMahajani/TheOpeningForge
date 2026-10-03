"""In-memory game/session management for Opening Forge's training drills."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal
from uuid import uuid4

import chess

from lines import LINES

Status = Literal["in_progress", "success", "off_line"]


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
    state = {
        "fen": session.board.fen(),
        "pgn": _pgn(session.board),
        "status": session.status,
        "move_number": session.white_index + 1,
    }
    if session.board.is_checkmate():
        last_move = session.board.peek()
        state["checkmate"] = {
            "king_square": chess.square_name(session.board.king(session.board.turn)),
            "winner_square": chess.square_name(last_move.to_square),
        }
    return state


def get_legal_moves(session: Session) -> list[str]:
    """Return all legal moves from the current position in UCI format."""
    if session.status != "in_progress":
        return []
    return [move.uci() for move in session.board.legal_moves]


def guide(session: Session) -> list[str]:
    if session.status != "in_progress":
        return []
    remaining = [move for move in session.line["white_moves"] if move not in session.completed_white_moves]
    # Qxf7 is the finishing move, only available after both pieces are developed.
    if "h5f7" in remaining and len(remaining) > 1:
        remaining.remove("h5f7")
    return [
        move_uci
        for move_uci in remaining
        if chess.Move.from_uci(move_uci) in session.board.legal_moves
    ]


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
    return snapshot(session), None


def _pgn(board: chess.Board) -> str:
    replay = chess.Board()
    parts: list[str] = []
    for move in board.move_stack:
        if replay.turn == chess.WHITE:
            parts.append(f"{replay.fullmove_number}. {replay.san(move)}")
        else:
            parts.append(replay.san(move))
        replay.push(move)
    return " ".join(parts)
