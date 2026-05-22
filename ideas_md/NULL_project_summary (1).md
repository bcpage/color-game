# NULL — Project Summary

*A working document. Last updated: May 2026 — Room 00002, naming, timestamps added.*

---

## What it is

NULL is a grid-based multiplayer web platform — a labyrinth of self-contained "rooms," each a different experience. It is built on Node.js with WebSockets for real-time state sharing across all connected players.

The colour game (a shared painting canvas) is Room 00001 — a proof-of-concept to validate the networking stack before building something more ambitious.

There are currently 21 rooms built (00001–00019). The ideas backlog contains 80+ more.

---

## The conceptual anchor

**NULL feels like you are inside SAP.**

SAP — enterprise resource planning software — is one of the most psychologically oppressive pieces of software ever built. Not because it tries to be. Because it just *is*. Endless tables. Transaction codes. You navigate by knowing the magic number. Everything is technically accessible. Nothing is intuitive. You are always slightly lost. You are always being tracked. Something is always pending your action.

The horror isn't dark hallways. It's bureaucracy without an exit.

NULL inherits this aesthetic deliberately:

- Rooms are **transactions**, not destinations
- You don't "go" somewhere — you enter a code, or you are routed there by a process you didn't initiate
- The system tracks you before you know you're being tracked
- Participation requires completing required fields
- Authorization objects gate what you can do
- The interface doesn't explain itself

**The player isn't sure, at first, if they've accidentally opened enterprise software or a game. That ambiguity is the experience.**

---

## Technical foundation

- **Server:** Node.js, no framework, raw HTTP + WebSocket (`ws` package)
- **Client:** Vanilla HTML/CSS/JS, single-file per room
- **State:** Server-side, broadcast to all connected clients
- **Transport:** WebSockets — real-time, shared across players
- **Deployment:** Currently local LAN only (runs on `0.0.0.0:3000`)
- **Future:** Router port-forward to expose externally; no code changes needed

The architecture is already correct for everything that follows. The server is the single source of truth. Clients are thin.

---

## Tone and aesthetic

- **Institutional + eerie.** Not horror. Not friendly. Clinical observation.
- **BBS / DOS / SAP.** Monospace. Tables. Codes. Sparse chrome.
- **Things that watch you back.** Presence is noted. Actions are logged. Milestones appear without fanfare.
- **Sincere, unsettling.** The "Inspirational Comments" room speaks in a genuine institutional voice: *"You came back. That matters."*
- **Ambiguity as design.** Dead rooms. Locked rooms. Rooms with wrong information. Rooms you can only reach by accident.

---

## User management — design decisions

### Identity model

1. **Cookie-first.** When a user first joins, they are assigned a browser cookie ID. They are tracked from this moment. They don't know what they are yet.
2. **Name tag as first act of identity.** At some room, the user is offered — or required — to fill out a name tag. This is the moment they choose to exist in the system.
3. **Gated participation.** You cannot write in the chat room until you have a name tag. In SAP terms: you lack the authorization object. The system does not explain why. It simply does not permit.

### The name tag room

The name tag room is not a friendly form. It is a **required field**. The system will not proceed without it. In tone, it should feel like being processed. Filed. Given a subject number. The name tag is not just UX — it is a lore moment. The first place a user chooses to exist.

### The user dashboard

A large data table. One row per user. Columns extend rightward as the game develops.

| Cookie ID | Name | [future columns...] |
|-----------|------|---------------------|

This is literally an **SAP ALV grid report** — the format SAP uses for everything. It fits the aesthetic exactly.

**Open design questions:**
- Who sees this table? Admin only? All players? Each user sees only themselves?
- Is the cookie ID shown to users, or only to the admin?
- "Subject 00247" (the system's name for you) vs. your chosen name creates intentional tension

**Recommended data architecture:** Store user data as a JSON blob server-side, keyed to cookie ID. Each new game mechanic writes new keys to it. The table renders whatever keys exist. No schema migrations needed as the game grows.

---

## Room 00002 — The Cookie Room

The second room is a cookie clicker. But it is not a cookie clicker.

**The mechanic:** The user must click at least once before they can proceed. One click is sufficient. They can click more — the count is recorded.

**What actually happens:** The moment they click, their cookie ID is generated and timestamped. The system records the exact moment they chose. They consented. The room is honest about this. They still won't see it.

**The message:** After the click, text appears on screen and holds — long enough to be slightly uncomfortable, long enough that the user wonders if something is wrong. Then it fades.

Candidate copy:
- *"You have chosen to generate your own cookie. It was not forced."*
- *"Your cookie was not assigned. You created it. This was your first action."*
- *"You clicked. A record was created. This was voluntary."*

The fade-out is part of the message. The discomfort is intentional.

**What it's doing:** Literally generating a cookie. Figuratively establishing consent. Foreshadowing everything the system will record from this moment forward. The user can figure this out later — or not.

**The cookie count:** The number of clicks is stored in the user record. A room later may reference it without explanation: *"You clicked 47 times."* No context given.

---

## Master user table — timestamp columns

The first few columns of the master table:

| Cookie ID | Name | First Seen | First Seen (Unix) | Cookie Clicks | ... |
|-----------|------|------------|-------------------|---------------|-----|

**"First Seen"** — not "Created" or "Joined." The system was watching before they arrived. They were noticed.

**Two timestamp formats side by side:**
- Human-readable: `2026-05-21 14:32:07`
- Unix: `1748536327`

Functional and aesthetic simultaneously. Two columns expressing the same fact in two languages — one the user speaks, one the system speaks. The Unix timestamp room later becomes the moment of recognition: *that number is when I clicked.*

---

## Naming exploration

### The words

**Portmanteau** — combining two words into one. *Brunch* (breakfast + lunch).

**Anagram** — rearranging the letters of a word to make another. *Listen* → *Silent*.

### NULL + SAP iterations

**Portmanteau candidates:**
- NULLSAP, SAPNULL, NULSAP, SAPNUL, NULLAP, SAULL, NASP, SPUN

**Anagram candidates** (letters: N, U, L, L, S, A, P):
- SLAP, LAPS, SPAN, PLAN, NAPS, PLUS, PALL, PULL, NULLS

**Standouts:** NASP feels like something. SLAP has energy. NULLAP looks like a product name.

---

## What to build next (suggested order)

1. **Cookie identity + server-side user store** — the foundation. Everything else depends on this. Assign ID on first connection, persist user JSON, serve it back on reconnect.

2. **Room 00002 — The Cookie Room** — first click generates and timestamps the cookie. Message fades. Count recorded. Gateway to everything that follows.

3. **Name tag room** — required field aesthetic. Unlocks chat and other gated features.

4. **Admin dashboard table** — your visibility into who exists. ALV grid aesthetic. Sparse at first, grows with the game.

5. **Chat room** — gated by name tag completion. First room where players interact with each other, not just the shared canvas.

6. **Login system + presence** (Part 2 in the ideas doc) — once identity is stable, presence tracking, "was observed" profile entries, activity histograms.

---

## Rooms backlog (selected)

### Already built
- 00001–00019 (21 rooms)

### Games
Calculator, Hangman, Dots and Boxes, MASH, Paper Soccer, Racetrack, Sokoban, Shooting Gallery, Monty Hall, Trolley Problem, Physics Sandbox, Shared Tamagotchi, Shared Chalkboard, Zork II, LORD, Dungeon Explorer (backrooms setting)

### Eerie / Atmospheric
The Countdown, The Hallway (infinite corridor, doors don't open), The Typewriter (collaborative ephemeral, page feeds after 90s silence), The Terminal (fake prompt, wrong outputs), The Form, The Plant (wilts if ignored), ELIZA, The Recursive Room, The Observation Room, Traffic Cameras, The Joshua Room (unlocks on Tic-Tac-Toe draw), 2am Room (unlocks 2am–3am only), Cheshire Cat, Empty Rooms ×3, Dead Rooms ×2-3, Game Over Rooms ×3-5, Black Hole (random redirect), Jump Scare (once per user, never again), MS-DOS HELP Interface, Interactive MS-DOS Prompt, 6-Panel Monitor Room

### Math & Science
UUID Generator, Invisible Character Room, The Illegal Prime, Prime Number Generator, Compression Engine, Galton Board, PRNG vs True RNG, Visible Spectrum + Non-Spectral Colors, Zeno's Paradox, Bootstrap Paradox, Ship of Theseus, Grandfather Paradox, Banach-Tarski, Russell's Barber, Sorites (Heap)

### Platform Mechanics
Login system + presence, Player profile page (subject file aesthetic), Room lock conditions (Myst-style), Forced movement, Moving rooms / labyrinth rearranges, Among Us meta-game (presence logs as alibis), Emergency Meeting button in nav, "Was observed." profile entry, Observations (milestones — no fanfare, appear in subject file)

---

## The thing worth remembering

The colour game took a spec document and a Claude Code session to build. The networking stack works. The foundation is solid.

What comes next is not more infrastructure. It is decisions about what kind of place NULL is — and then building rooms that make that place real.

The SAP anchor is the answer to that question. NULL is a place that processes you. You arrive as a cookie. You become a subject. You accumulate a file. The game is learning what your file contains.

---

*End of document.*
