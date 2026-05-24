# Room 00074 — Jump Scare

## What it is
A room that appears empty. On the first visit, "THERE YOU ARE" flashes after a delay.

## How it works
- localStorage key: `null_jumpscare_74`
- First visit only: 2.8s delay, then "#e94560 THERE YOU ARE" text flashes for 1.4s then fades
- All subsequent visits: the room is completely empty (no text, no UI)
- matrix-nav chrome still loads as usual

## Navigation
- data-nav: matrix
- Connects to: 00073 (left), 00075 (right)

## Notes
- The emptiness on return visits is the real mechanic — the room becomes a dead end
- Works best discovered by chance during navigation
