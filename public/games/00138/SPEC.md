# Room 00138 — Galton Board

## What it is
Animated Galton board (bean machine / quincunx). Balls fall through 8 rows of pegs, bouncing left or right randomly at each peg, accumulating in 9 bins. A normal distribution emerges from purely binary random choices. Optional bell curve overlay confirms the Central Limit Theorem.

## Navigation
- data-nav: matrix
- Connections: 00137 ← → 00139

## Notes
- Fully client-side — no server, no persistence
- 8 peg rows, 9 bins
- Speed modes: Slow / Med / Fast / Instant (instant skips animation, drops directly to bins)
- Drop 1 / 10 / 100 / 1000 balls
- Curve overlay uses PDF of N(4, 1) scaled to expected peak height
- Bin bars scale dynamically as peak grows
- Ball count and peak bin shown in HUD
- Connection to PRNG room: both explore randomness; note in room description
