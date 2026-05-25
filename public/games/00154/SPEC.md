# Room 00154 — The NULL Room

## What it is
The full facility map. All rooms as nodes arranged in a 16-column spatial grid, all connections as dim edges, live presence overlaid. Occupied rooms glow red and pulse. Room 00154 (you) glows orange. You can see the shape of the whole place from here.

## Navigation
- data-nav: matrix
- Connections: 00153 ← → 00155

## Notes
- Client-side canvas (560×420); 16 cols × rows, CELL_W=28, CELL_H=24
- Connections: reconstructed arithmetically from /api/games (right=+1, left=-1, up=+10, down=-10), same logic as matrix-nav.js
- Edges rendered as dim blue-gray lines (rgba 30,50,80 @ 35%) underneath nodes
- Nodes: empty = 1.5px dark dot; occupied = 3px colored dot + radial glow, pulsing
- Presence data: initial fetch /api/presence, then WS { game:'presence', type:'update' }
- Stats: total rooms, total edges, active visitors, "you are in 00154"
- Landmark labels: rooms 00001, 00050, 00100, 00150, 00154 get tiny ID text above node
- Note: "The bright ones have people in them. You are looking at the shape of a place most visitors never see whole."
