# Room 00109 — Physics Engine

## What it is
Interactive Matter.js physics sandbox. Click to spawn objects. Gravity can be toggled between normal, inverted, zero-G, and chaotic. Bodies can be dragged with the mouse.

## Mechanic
- BOX: spawn a randomly-sized rectangle
- BALL: spawn a bouncy circle
- RAGDOLL: spawn a 6-segment chain with side arms connected by constraints
- BOMB: spawns a heavy sphere that detonates after 0.6s, applying force to nearby bodies
- GRAVITY button cycles through ↓ normal / ↑ inverted / zero-G / chaotic (slight horizontal drift)
- CLEAR: removes all non-static bodies
- Auto-culls oldest body when count exceeds 80

## Navigation
- data-nav: matrix
- Connections: 00108 ← (dead end for now)

## Notes
- Matter.js 0.19.0 loaded from cdnjs CDN
- Mouse constraint allows dragging live objects
- Starter boxes spawn on load
- Body limit prevents runaway performance degradation
