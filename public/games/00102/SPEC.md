# Room 00102 — Binary Control Panel

## What it is
8 toggle switches representing an 8-bit register. Each switch controls one bit (bit 7 = MSB on the left, bit 0 = LSB on the right). The current byte value is shown in binary, decimal, hex, and ASCII (if printable).

## Mechanic
Click any switch to toggle its bit. Keyboard shortcut: keys 0–7 flip the corresponding bit. State is broadcast via WebSocket — all visitors see the same byte value.

## Navigation
- data-nav: matrix
- Connections: 00101 ← → 00103

## Notes
- Reuses the existing `game: 'ascii'` WebSocket protocol (asciiBits state on server)
- Pure client-side HTML; no new server logic needed
- Separator between bit 4 and bit 3 groups the nibbles visually
