"""The deliberately suboptimal Black replies used by the trainer.

Each entry is a complete, legal sequence of White moves and forced Black replies.
Moves are UCI strings so comparisons are unambiguous at the API boundary.
"""

LINES = [
    {
        "name": "Scholar's Mate",
        "target": "checkmate",
        "flexible_white_order": True,
        "white_moves": ["e2e4", "d1h5", "f1c4", "h5f7"],
        "black_moves": ["e7e5", "b8c6", "g8f6"],
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
        "name": "Fried Liver (Kg8 Trap)",
        "target": "checkmate",
        "flexible_white_order": True,
        "move_prerequisites": {
            "g1f3": ["e2e4"],
            "f1c4": ["e2e4"],
            "f3g5": ["g1f3", "f1c4"],
            "e4d5": ["f3g5"],
            "g5f7": ["e4d5"],
            "d1f3": ["g5f7"],
            "c4d5": ["d1f3"],
            "f3d5": ["c4d5"],
            "d5e6": ["f3d5"],
        },
        # 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5
        # 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Kg8?
        # 8. Bxd5+ Qxd5 9. Qxd5+ Be6 10. Qxe6#
        # This is a trap line: 7...Kg8? loses by force; 7...Ke6 is Black's
        # resilient defence and belongs in a separate non-mating variation.
        "white_moves": [
            "e2e4", "g1f3", "f1c4", "f3g5", "e4d5", "g5f7", "d1f3",
            "c4d5", "f3d5", "d5e6",
        ],
        "black_moves": [
            "e7e5", "b8c6", "g8f6", "d7d5", "f6d5", "e8f7", "f7g8",
            "d8d5", "c8e6",
        ],
    },
    {
        "name": "Scotch Gambit",
        "white_moves": ["e2e4", "g1f3", "d2d4"],
        "black_moves": ["e7e5", "b8c6", "e5d4"],
    },
]
