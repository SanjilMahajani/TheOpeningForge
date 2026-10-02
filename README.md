# Opening Forge

A local FastAPI chess-opening trainer. Its first drill is Scholar's Mate against randomized, suboptimal Black lines. Legal moves and checkmate detection use `python-chess`.

## Run locally

Requires Python 3.11+.

```bash
python3.11 -m venv .venv
source .venv/bin/activate       # Windows: .venv\\Scripts\\activate
python3 -m pip install -r requirements.txt
cd backend
python3 -m uvicorn main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Drag White's pieces to play. Enable **Show move guide** to reveal the next expected move in coordinate notation.

## API

- `POST /new-session` starts a randomized line.
- `POST /move` accepts JSON: `{ "session_id": "...", "move": "e2e4" }`.
- `GET /state?session_id=...` returns the board and session status.
- `GET /guide?session_id=...` returns the expected next White UCI move.

Sessions live only in server memory and reset when the server restarts.
