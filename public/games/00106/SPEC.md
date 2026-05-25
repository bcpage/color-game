# Room 00106 — Game Over (Lockout 3)

## What it is
Third of three Game Over rooms. Terminal/CLI aesthetic — shows the lockout as fake function call output in a monospaced terminal window.

## Mechanic
Same as 00104 — POST to /api/gameover/00106 on load, countdown displayed. Aesthetic: NULL platform terminal session with session.status(), user.clearance(), and lock.info() calls.

## Navigation
- data-nav: matrix
- Connections: 00105 ← → 00107

## Notes
- Shares /api/gameover/:room endpoint with rooms 00104 and 00105
- Each room's lockout is independent per device
