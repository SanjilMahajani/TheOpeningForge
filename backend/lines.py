"""The deliberately suboptimal Black replies used by the trainer.

Each entry is a complete, legal sequence of White moves and forced Black replies.
Moves are UCI strings so comparisons are unambiguous at the API boundary.
"""

LINES = [
    {
        "name": "The loose knight defence",
        "white_moves": ["e2e4", "d1h5", "f1c4", "h5f7"],
        "black_moves": ["e7e5", "b8c6", "g8f6"],
    },
    {
        "name": "The centre pawn delay",
        "white_moves": ["e2e4", "f1c4", "d1h5", "h5f7"],
        "black_moves": ["e7e5", "b8c6", "d7d6"],
    },
    {
        "name": "The pawn push trap",
        "white_moves": ["e2e4", "f1c4", "d1h5", "h5f7"],
        "black_moves": ["e7e5", "d7d6", "b8c6"],
    },
    {
        "name": "The queen-side distraction",
        "white_moves": ["e2e4", "d1h5", "f1c4", "h5f7"],
        "black_moves": ["e7e5", "a7a6", "b8c6"],
    },
]
