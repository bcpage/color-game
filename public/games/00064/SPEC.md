# [00064] — Wrong Snake

**Status:** Built
**Last updated:** 2026-05-23

## What it is
Snake where eating food grows the snake at the tail instead of the head. Movement
and controls work normally. When food is eaten, the head advances as usual but an
extra segment is extrapolated and appended at the opposite end. The snake stretches
backward on each meal. Arrow keys or WASD. Auto-restarts on death.

## How it works
Canvas 400×400, 20×20 grid. 120ms tick. On food eaten: head moves forward (old tail
removed), new tail segment extrapolated from last two segments' direction. Bounds
clamped. If extrapolated position collides with body, falls back to duplicating the
last segment. Red food, dim snake body gradient from head to tail. No server calls.

## Data files
None.

## Navigation
Matrix nav. Connects: 00063 (left), 00065 (right).

## Locked content
None.

## Notes for future development
The "grows at tail" mechanic is subtle at first — players may not notice immediately,
which is intentional. Could add a label showing where growth is happening.
Could add touch swipe controls for mobile.
