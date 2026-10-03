from pathlib import Path
import random

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from game import create_session, get_session, guide, get_legal_moves, play_white_move, snapshot
from lines import LINES

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"

app = FastAPI(title="Opening Forge")


class MoveRequest(BaseModel):
    session_id: str = Field(min_length=1)
    move: str = Field(min_length=4, max_length=6)


class NewSessionRequest(BaseModel):
    opening_name: str | None = None


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(FRONTEND / "index.html")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    """Browsers request this automatically; no favicon is needed for the MVP."""
    return Response(status_code=204)


@app.get("/openings")
def get_openings():
    return {"openings": [line["name"] for line in LINES]}


@app.post("/new-session")
def new_session(request: NewSessionRequest = NewSessionRequest()):
    opening = None
    if request.opening_name:
        for line in LINES:
            if line["name"] == request.opening_name:
                opening = line
                break
    if not opening:
        opening = random.choice(LINES)

    session_id, session = create_session(opening)
    return {"session_id": session_id, **snapshot(session)}


@app.post("/move")
def move(request: MoveRequest):
    session = _session_or_404(request.session_id)
    state, error = play_white_move(session, request.move.lower())
    return {**state, "error": error}


@app.get("/state")
def state(session_id: str):
    return snapshot(_session_or_404(session_id))


@app.get("/guide")
def get_guide(session_id: str):
    session = _session_or_404(session_id)
    return {"moves": guide(session)}


@app.get("/legal-moves")
def get_legal_moves_endpoint(session_id: str):
    session = _session_or_404(session_id)
    return {"moves": get_legal_moves(session)}


def _session_or_404(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found. Start a new game.")
    return session


app.mount("/static", StaticFiles(directory=FRONTEND), name="static")
