# [00066] — River Crossing

**Status:** Built
**Last updated:** 2026-05-23

## What it is
Alcuin's fox-chicken-grain river crossing puzzle, c. 800 AD. Click entities on the
current bank to load them into the boat (one passenger max), then press Cross. Invalid
states (fox+chicken or chicken+grain alone without farmer) auto-detect and reset.
Move log tracks every crossing. Two solutions exist; both are reachable.

## How it works
Client-side state machine. State = {farmer, fox, chicken, grain} each 0 (west) or 1
(east). Boat side tracked separately. Validity checked after each crossing: if fox
and chicken share a bank without the farmer, or chicken and grain do, state is invalid
and the puzzle resets after 1.2 seconds with an error message. Win detected when all
entities reach east bank. No server calls.

## Data files
None.

## Navigation
Matrix nav. Connects: 00065 (left), 00067 (right).

## Locked content
None.

## Notes for future development
Could track number of solves and show "X visitors have solved this" from server.
Could add a hint system that highlights valid next moves. Currently no hints.
The attribution to Alcuin is accurate — this is one of the oldest recorded puzzles.
