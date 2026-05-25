# Room 00124 — Alternate Hangman: One Life

## What it is
One shared global Hangman game. All players share it. When someone guesses a letter, every other player sees the same state. When the game ends (win or loss), it is permanently over — the word and outcome are displayed forever after. No reset.

## Navigation
- data-nav: matrix
- Connections: 00123 ← → 00125

## Notes
- Server state: `/api/hangman` GET, `/api/hangman/guess` POST
- Persistent state in `public/games/00124/data/hangman.json`
- Word chosen at server first-run from a fixed list of atmospheric/facility words
- Max 6 wrong guesses (classic hangman), ASCII gallows
- Keyboard input or click
- End state shows the word and is permanent — no restart route
- Server code added in commit e9bb4f2
