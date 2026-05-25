# Room 00135 — Vector Race (Racetrack)

## What it is
Two-player WebSocket vector racing game. Each turn, adjust your velocity by ±1 in X and Y (or hold). Position updates by current velocity. Crash into walls = velocity reset, stay in place. First player to reach column 22 (finish line) wins. Spectators see live state. Seat confirmation sent as private WS message.

## Navigation
- data-nav: matrix
- Connections: 00134 ← → 00136

## Notes
- Server: `game:'race'` WS protocol. State broadcast to all. Seat assigned privately.
- 24×16 grid, finish line at col 22
- Max velocity: ±4 in each axis
- 9-button velocity pad (↖↑↗←●→↙↓↘) + keyboard numpad / arrows
- Trail shown for both players with position dots
- Crash animation (✕ flash)
- 4-second reset after win
- Spectators see full state but cannot move
- Seats vacated on disconnect, game pauses to 'waiting'
