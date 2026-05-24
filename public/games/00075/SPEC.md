# Room 00075 — Black Hole

## What it is
A redirect room. Visiting it immediately sends you somewhere else at random.

## How it works
- Fetches `/api/games` to get the full room list
- Filters out `'00075'` (won't send you back to itself)
- Picks a random room, displays the number briefly, then redirects after 1.2s
- Fallback: redirects to `/game/00001` if the API fails

## Navigation
- data-nav: matrix
- Connects to: 00074 (left), 00076 (right)
- Note: you can't linger here — the page navigates away on its own

## Notes
- The Switchboard (00076) switch index 74 says "you already know" — a nod to this room
- The destination display gives players just enough time to read it before being taken there
