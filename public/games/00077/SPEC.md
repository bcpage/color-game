# Room 00077 — Wrong Space Invaders

## What it is
Space Invaders where something is subtly wrong: alien bombs fall from the player's position, not the alien's.

## How it works
- Standard Space Invaders: 4×11 alien grid, player moves left/right, fires bullets upward
- The wrong mechanic: when any alien fires a bomb, the bomb originates at the player's current X coordinate (not the alien's X)
- This means moving left makes the bombs come from the left; staying still makes all bombs converge on you
- 5 waves; aliens speed up each wave; barriers degrade on hit
- Score: row 0 = 40 pts, row 1/2 = 30 pts, row 3 = 10 pts

## Navigation
- data-nav: matrix
- Connects to: 00076 (left)

## Notes
- The "wrong" mechanic is discoverable: players notice bombs don't come from where aliens are
- Optimal strategy is to keep moving — stationary players get bombed directly
- Last room in the current chain (00077)
