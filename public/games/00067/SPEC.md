# [00067] — Ominous Countdown Timer

**Status:** Built
**Last updated:** 2026-05-23

## What it is
A room containing only a countdown timer in HH:MM:SS format. No label explaining
what it counts to. No label explaining what happens at zero. When it reaches zero,
the user is redirected to /game/00000 (the welcome screen) and the timer resets to
a new random duration. The timer persists in localStorage per browser.

## How it works
Client-side only. On load: checks localStorage for a target timestamp. If none,
or if the existing target has already passed, sets a new one: now + random(2h–48h).
Ticks every second. At zero: removes localStorage key, waits 1.2 seconds (shows
"00:00:00"), then redirects to /game/00000. No server calls.

## Data files
None (localStorage only).

## Navigation
Matrix nav. Connects: 00066 (left).

## Locked content
None.

## Notes for future development
A server-side global timer (same deadline for all users) would be more consistent
with the facility aesthetic — everyone's clock runs out at the same moment. Would
require a new API endpoint and a data file. Current localStorage approach is per-
browser and invisible to other users.

The 2–48 hour range means most users will never see it fire. That is intentional.
The ominous part is the ticking, not the outcome.
