# Room 00104 — Game Over (Lockout 1)

## What it is
The first of three Game Over rooms. Entering triggers a server-side lockout of a random duration (1–23 hours). The user cannot leave via the nav while locked — they see a countdown to when access resumes.

## Mechanic
On load, POSTs to /api/gameover/00104. Server records a lockout timestamp for the device. If already locked, returns existing timer. Countdown shown in HH:MM:SS. Aesthetic: classic arcade red GAME OVER with CRT flicker.

## Navigation
- data-nav: matrix
- Connections: 00103 ← → 00105

## Notes
- No nav-locking implemented — user can still navigate away, but the lockout persists server-side
- Lockout is per device UUID cookie
- Random 1–23 hour duration set on first POST; subsequent POSTs return existing lock
