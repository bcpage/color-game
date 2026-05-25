# Room 00107 — Wrong Tetris

## What it is
Tetris-like falling block game, but all pieces are deliberately malformed pentominoes and irregular shapes that cannot cleanly tile the board. Lines can still clear (so it feels like Tetris) but gaps are always inevitable. The game cannot be won.

## Mechanic
Standard Tetris controls: ← → move, ↑ rotate (with wall kick), ↓ soft drop, space hard drop. Ghost piece shown. Score by lines cleared. 10-wide board. Pieces are C-shapes, plus signs, F-pentominoes, and other misfits. Game over when board fills; auto-resets after 2 seconds.

## Navigation
- data-nav: matrix
- Connections: 00106 ← → 00108

## Notes
- Pure client-side; no server logic
- GAME CANNOT BE WON label shown at top
- 8 wrong piece types defined; each randomly pre-rotated on spawn
- Drop speed increases every 5 lines
