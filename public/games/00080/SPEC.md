# Room 00080 — Monty Hall Problem

## What it is
The classic probability puzzle. Three doors: one hides a car, two hide goats. You pick one. A goat door is revealed. Should you switch?

## Mechanic
1. Player picks a door
2. Server (Monty) reveals one of the unchosen goat doors
3. Player chooses to stay or switch
4. Result revealed. Auto-resets after 3 seconds.
5. Aggregate stats accumulate across all players — stay win %, switch win % — proving the theory in real data.

## Navigation
- data-nav: matrix
- Connections: 00079 ← → 00081

## Server
- GET /api/monty — returns aggregate stats { stayed_win, stayed_loss, switched_win, switched_loss }
- POST /api/monty — records one result { action: 'stay'|'switch', won: bool }
- Data: public/games/00080/data/monty.json
