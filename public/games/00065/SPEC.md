# [00065] — Wrong Breakout

**Status:** Built
**Last updated:** 2026-05-23

## What it is
Breakout where breaking a brick spawns two new bricks in random empty cells. The board
never depletes — it grows by one net brick per hit. Eventually the field fills completely,
at which point spawning fails silently and the game approaches a normal (but unwinnable)
breakout state. Stats displayed: bricks broken, bricks spawned, current brick count.

## How it works
Canvas 480×360. 10×6 brick grid. Mouse-controlled paddle. Standard ball physics with
correct reflection. On brick hit: remove brick, spawn 2 random empty cells. Lives
system (3 lives). Auto-restarts on game over. No server calls.

## Data files
None.

## Navigation
Matrix nav. Connects: 00064 (left), 00066 (right).

## Locked content
None.

## Notes for future development
Could show the spawn animation (flash the new bricks). Currently spawns silently.
The "broken: X / spawned: Y" counter makes the paradox legible — players quickly
realize the board is growing, not shrinking.
