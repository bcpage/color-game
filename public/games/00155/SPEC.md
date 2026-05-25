# Room 00155 — Waiting Room

## What it is
A waiting room. Tracks how long you've been here with a running HH:MM:SS timer. Assigns a random queue number (100–899, stored in localStorage). Shows 12 seat icons — your seat glows green, others waiting (from presence data) shown as occupied. Rotates through 10 institutional messages every 12 seconds. Nothing ever happens.

## Navigation
- data-nav: matrix
- Connections: 00154 ← → 00156

## Notes
- Fully client-side — no server API (presence via WS only)
- Timer: starts on page load, formatted HH:MM:SS
- Queue number: localStorage 'waiting_num', random 100–899 assigned once
- Visit count: localStorage 'waiting_visits', increments each load
- Seat row: 12 seats, first = you (green ▣), up to presence['00155']-1 = others (blue ▪), rest empty (·)
- Others count: presence['00155'] - 1 (subtracts self)
- Message rotation: 10 messages, fade out/in every 12s using color transition
- Note: "No one has been called. The number system is operational. Please wait."
