"""The deliberately suboptimal Black replies used by the trainer.

Each entry is a complete, legal sequence of White moves and forced Black replies.
Moves are UCI strings so comparisons are unambiguous at the API boundary.
"""

LINES = [
    {
        "name": "Scholar's Mate (Loose Knight)",
        "flexible_white_order": True,
        "white_moves": ["e2e4", "d1h5", "f1c4", "h5f7"],
        "black_moves": ["e7e5", "b8c6", "g8f6"],
    },
    {
        "name": "Scholar's Mate (Centre Delay)",
        "flexible_white_order": True,
        "white_moves": ["e2e4", "f1c4", "d1h5", "h5f7"],
        "black_moves": ["e7e5", "b8c6", "d7d6"],
    },
    {
        "name": "Italian Game (Slow)",
        "white_moves": ["e2e4", "g1f3", "f1c4"],
        "black_moves": ["e7e5", "b8c6", "d7d6"],
    },
    {
        "name": "London System (Standard)",
        "white_moves": ["d2d4", "c1f4", "e2e3"],
        "black_moves": ["d7d5", "g8f6", "e7e6"],
    },
    {
        "name": "Fried Liver",
        # 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5
        # 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6
        # 8. Nc3 Nb4 9. O-O c6 10. d4 Qf6
        # White keeps the attack and avoids the inferior 9.a3? Nxc2+ line,
        # where Black can win the a1 rook.
        "white_moves": [
            "e2e4", "g1f3", "f1c4", "f3g5", "e4d5", "g5f7", "d1f3",
            "b1c3", "e1g1", "d2d4",
        ],
        "black_moves": [
            "e7e5", "b8c6", "g8f6", "d7d5", "f6d5", "e8f7", "f7e6",
            "c6b4", "c7c6", "d8f6",
        ],
    },
    {
        "name": "Scotch Gambit",
        "white_moves": ["e2e4", "g1f3", "d2d4"],
        "black_moves": ["e7e5", "b8c6", "e5d4"],
    },
]
