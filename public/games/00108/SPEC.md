# Room 00108 — Wrong Pac-Man

## What it is
Pac-Man but the ghosts flee from the player instead of chasing. Dots respawn when all collected. There is no win state. The game continues forever.

## Mechanic
Arrow keys to move Pac-Man. 4 ghosts use a "max-distance" fleeing algorithm — they move to the cell furthest from the player. Power pellets (larger red dots) make ghosts temporarily chase instead of flee (inverted logic). Score counts dots eaten. Timer shows session length.

## Navigation
- data-nav: matrix
- Connections: 00107 ← → 00109

## Notes
- Pure client-side; no server logic
- GAME CANNOT BE WON label shown at top
- 19×19 grid with symmetric hand-designed maze
- Dots respawn automatically when all collected
- Pac-Man wraps around edges via modulo arithmetic
