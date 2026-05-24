# [00060] — Paradox: Grandfather

**Status:** Built
**Last updated:** 2026-05-23

## What it is
The grandfather paradox. A button labeled "Travel back in time" triggers a scripted
log sequence: 15 steps showing the causal loop playing out — you prevent your
grandfather meeting your grandmother, therefore you're never born, therefore you
can't travel back, therefore they meet, therefore you're born, therefore you
travel back... The sequence ends with "[loop continues]."

## How it works
Click handler fires a setTimeout chain over ~15 seconds. Each step appends a log
entry (fades in). When complete, re-enables the button as "Travel back in time again."
Three lines appear in red (the contradiction moment). No server calls.

## Data files
None.

## Navigation
Matrix nav. Connects: 00059 (left), 00061 (right).

## Locked content
None.

## Notes for future development
Could loop the sequence automatically after the first run (infinite loop aesthetic).
Currently requires a second click to replay. Resolutions section covers Novikov
self-consistency, many-worlds branching, and temporal immunity.
