# [00063] — Wrong Pong

**Status:** Built
**Last updated:** 2026-05-23

## What it is
Pong where the ball bounces at a random angle on every paddle contact instead of
the correct reflection angle. Player controls the left paddle with mouse. AI controls
the right paddle with slight imperfection. Score tracked. The wrong thing: after a
few volleys, the ball's trajectory becomes completely unpredictable.

## How it works
Canvas 600×380. 60fps requestAnimationFrame loop. Ball bounces correctly off walls
(top/bottom), randomly off paddles (random angle ±50° from horizontal, random speed
variation). AI tracks ball.y with a fixed speed and small noise offset. Cursor hidden
over canvas. No server calls.

## Data files
None.

## Navigation
Matrix nav. Connects: 00062 (left), 00064 (right).

## Locked content
None.

## Notes for future development
Could add a "serving notice" or a label that names what's wrong ("ANGLE: RANDOM").
Could add touch support for mobile. Currently mouse only.
