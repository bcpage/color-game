# Room 00105 — Game Over (Lockout 2)

## What it is
Second of three Game Over rooms. Same lockout mechanic as 00104 but with an arcade cabinet aesthetic — large ASCII GAME OVER art, blinking INSERT COIN, score display showing 000000, and a continue countdown.

## Mechanic
Same as 00104 — POST to /api/gameover/00105 on load, countdown displayed. Aesthetic: 1980s arcade high-score screen.

## Navigation
- data-nav: matrix
- Connections: 00104 ← → 00106

## Notes
- Shares /api/gameover/:room endpoint with rooms 00104 and 00106
- Each room maintains its own separate lockout per device
