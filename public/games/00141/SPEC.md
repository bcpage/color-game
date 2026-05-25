# Room 00141 — Shape Factory

## What it is
A 6×6 grid where users draw custom piece shapes (3–6 connected cells) and submit them to a shared pool. Wrong Tetris (00107) loads pieces from this pool and mixes them in at a 30% rate. The factory makes the broken game more broken.

## Navigation
- data-nav: matrix
- Connections: 00140 ← → 00142

## Notes
- Server: `GET /api/shapes` returns pool; `POST /api/shapes` adds a piece
- Validation: 3–6 cells, within 6×6 bounds, all cells orthogonally connected (BFS check)
- Max pool size: 100 pieces (oldest pruned beyond 100)
- Color picker: 8 preset colors; piece rendered in chosen color
- Preview canvas shows normalized piece at center
- Wrong Tetris (00107) modified: fetches `/api/shapes` on load; 30% chance of picking custom piece
- Broadcast: `{ type: 'shapes_update', count, total }` when new piece added
- Data: `public/games/00141/data/shapes.json`
- Note: "Every piece you submit will be used. Wrong Tetris will never win. Your piece will make it worse. This is the purpose of the factory."
