# Room 00117 — Wire Connection Panel

## What it is
A Number Link / Flow Free puzzle framed as a circuit routing panel on a TV monitor. Connect colored endpoint pairs with paths; all cells must be filled to complete the puzzle.

## Mechanic
Click an endpoint to start drawing that color. Move mouse to adjacent cells to extend the path. Reach the other endpoint to complete the pair. Clicking a different endpoint of the same color erases and restarts. Three puzzles selectable; CLEAR resets current. Win: all pairs connected AND all 36 cells filled.

## Navigation
- data-nav: matrix
- Connections: 00116 ← (dead end for now)

## Notes
- Pure client-side; no server logic
- 6×6 grid, 5 color pairs per puzzle
- BFS connectivity validation for each pair
- Touch support for mobile
